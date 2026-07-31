'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { appUrl } from '@/config/brand';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import {
  createQuestionSchema,
  deleteQuestionSchema,
  reorderQuestionsSchema,
  rsvpSubmissionSchema,
  updateQuestionSchema,
} from '@/features/rsvp/schemas';
import { readRsvpSection } from '@/features/rsvp/section-data';
import { checkFormNonce } from '@/lib/form-nonce';
import { requireEventAccess } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { clientFingerprint } from '@/server/request-info';
import { recordActivity } from '@/server/services/events';
import { notifyNewResponse } from '@/server/services/notifications';
import { formScope } from '@/server/services/live-context';
import { resolvePublicAccess } from '@/server/services/public-invitation';
import {
  createRsvpQuestion,
  deleteRsvpQuestion,
  deleteRsvpResponse,
  findRecipientByToken,
  loadResponseByEditToken,
  reorderRsvpQuestions,
  submitRsvp,
  updateRsvpQuestion,
} from '@/server/services/rsvp';
import { z } from 'zod';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Slanje i uređivanje odgovora na pozivnicu (zahtev 12 i 13).
 *
 * Javni deo je jedina server akcija koju poziva neko bez naloga, pa ona sama
 * proverava **sve**: da li je pozivnica objavljena, da li je rok prošao, da li
 * gost sme da je vidi i da li je obrazac zaista naš. Skriveno dugme na klijentu
 * ovde ne znači ništa (zahtev 24).
 */

export type RsvpSubmitResult = {
  status: 'yes' | 'no' | 'maybe';
  isUpdate: boolean;
  /** Link za kasniju izmenu; postoji samo kada je odgovor upravo napravljen. */
  editUrl: string | null;
};

export async function submitRsvpAction(
  input: unknown,
): Promise<ActionResult<RsvpSubmitResult>> {
  try {
    const parsed = rsvpSubmissionSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const data = parsed.data;

    /*
     * Polje-mamac je popunjeno: obrazac je poslao automat. Odgovor je namerno
     * „uspešno" - poruka o grešci bi automatu rekla šta da promeni, a pravi
     * gost ovo polje ne vidi ni kada mu pregledač nudi automatsko popunjavanje
     * (sakriveno je sa `display: none`).
     */
    if (data.companyName.trim() !== '') {
      return success({ status: data.status, isUpdate: false, editUrl: null });
    }

    const fingerprint = await clientFingerprint();
    const limit = await rateLimit(`rsvp:${data.slug}:${fingerprint}`, RATE_LIMITS.rsvpSubmit);
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše pokušaja u kratkom roku. Sačekajte nekoliko minuta pa probajte ponovo.',
      );
    }

    const nonce = checkFormNonce(formScope(data.slug), data.nonce);
    if (nonce === 'too_fast') {
      // Čovek ne popuni ime i broj gostiju za dve sekunde.
      return success({ status: data.status, isUpdate: false, editUrl: null });
    }
    if (nonce !== 'ok') {
      return failure(
        'validation',
        'Obrazac je istekao. Osvežite stranicu i pošaljite odgovor ponovo.',
      );
    }

    const store = await cookies();
    const access = await resolvePublicAccess({
      slug: data.slug,
      recipientToken: data.token || null,
      pinProof: store.get(pinCookieName(data.slug))?.value ?? null,
    });

    if (access.state !== 'ok') {
      // Ne otkrivamo zašto: nepostojeća, nacrt i zaključana pozivnica izgledaju
      // isto nekome ko nema pravo da je vidi.
      return failure('not_found', 'Pozivnica trenutno ne prima odgovore.');
    }

    const invitation = access.invitation;
    const section = readRsvpSection(invitation.document);

    if (!section) {
      return failure('not_found', 'Ova pozivnica ne prikuplja potvrde dolaska.');
    }

    if (isDeadlinePassed(section.deadline, invitation.timeZone)) {
      return failure('forbidden', 'Rok za potvrdu dolaska je prošao.');
    }

    const recipient = await findRecipientByToken(
      invitation.invitationId,
      data.token,
    );

    const editing = data.editToken
      ? await loadResponseByEditToken(invitation.invitationId, data.editToken)
      : null;

    if (data.editToken && !editing) {
      return failure('not_found', 'Link za izmenu odgovora više ne važi.');
    }

    const result = await submitRsvp({
      invitationId: invitation.invitationId,
      recipient,
      responseId: editing?.responseId ?? null,
      fullName: data.fullName,
      email: section.askContact ? data.email : '',
      phone: section.askContact ? data.phone : '',
      status: data.status,
      adultsCount: data.adultsCount,
      childrenCount: section.askChildren ? data.childrenCount : 0,
      companions: section.askCompanionNames ? data.companions : [],
      message: section.askMessage ? data.message : '',
      answers: data.answers as Record<string, unknown>,
    });

    revalidatePath(`/app/dogadjaji/${invitation.eventId}/odgovori`);
    revalidatePath(`/app/dogadjaji/${invitation.eventId}`);

    await recordActivity({
      eventId: invitation.eventId,
      invitationId: invitation.invitationId,
      kind: result.isUpdate ? 'rsvp_updated' : 'rsvp_created',
      payload: { status: result.status },
    });

    /*
     * Obaveštenje ide samo za nov odgovor.
     *
     * Izmena postojećeg odgovora ne šalje poruku: gost koji se dvaput
     * predomisli ne treba da napuni sanduče organizatora. Servis sam poštuje
     * izabranu učestalost, a greška u slanju se guta - gost je svoje uradio i
     * ne sme da vidi grešku zbog naše pošte.
     */
    if (!result.isUpdate) {
      await notifyNewResponse({
        eventId: invitation.eventId,
        guestName: data.fullName,
        status: result.status,
        people: data.adultsCount + (section.askChildren ? data.childrenCount : 0),
      }).catch(() => undefined);
    }

    return success({
      status: result.status,
      isUpdate: result.isUpdate,
      editUrl: result.editToken
        ? appUrl(`/p/${invitation.slug}/odgovor/${result.editToken}`)
        : null,
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Rok se meri po kraju dana u vremenskoj zoni događaja.
 *
 * Gost koji šalje odgovor u 23:50 na sam dan roka nije zakasnio - a bio bi
 * odbijen da se rok tumači kao ponoć u UTC-u.
 */
function isDeadlinePassed(
  deadline: string | null,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return today > deadline;
}

// --- Dodatna pitanja (organizator) ------------------------------------------

export async function createQuestionAction(
  input: unknown,
): Promise<ActionResult<{ questionId: string }>> {
  try {
    const parsed = createQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    const result = await createRsvpQuestion(parsed.data.eventId, parsed.data.question);
    revalidateRsvpPages(parsed.data.eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateQuestionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = updateQuestionSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await updateRsvpQuestion(
      parsed.data.eventId,
      parsed.data.questionId,
      parsed.data.question,
    );
    revalidateRsvpPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteQuestionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = deleteQuestionSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await deleteRsvpQuestion(parsed.data.eventId, parsed.data.questionId);
    revalidateRsvpPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function reorderQuestionsAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = reorderQuestionsSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await reorderRsvpQuestions(parsed.data.eventId, parsed.data.questionIds);
    revalidateRsvpPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

const deleteResponseSchema = z.object({ eventId: z.uuid(), responseId: z.uuid() });

export async function deleteResponseAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = deleteResponseSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await deleteRsvpResponse(parsed.data.eventId, parsed.data.responseId);
    revalidateRsvpPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

function revalidateRsvpPages(eventId: string): void {
  revalidatePath(`/app/dogadjaji/${eventId}/odgovori`);
  revalidatePath(`/app/dogadjaji/${eventId}/gosti`);
  revalidatePath(`/app/dogadjaji/${eventId}`);
}
