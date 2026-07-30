'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import {
  GUESTBOOK_REACTIONS,
  deleteEntrySchema,
  guestbookEntrySchema,
  moderateEntrySchema,
} from '@/features/guestbook/schemas';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import { readGuestbookSection } from '@/features/rsvp/section-data';
import { checkFormNonce } from '@/lib/form-nonce';
import { requireEventAccess } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { clientFingerprint } from '@/server/request-info';
import {
  addGuestbookEntry,
  deleteGuestbookEntry,
  moderateGuestbookEntry,
} from '@/server/services/guestbook';
import {
  resolvePublicAccess,
  revalidateInvitation,
} from '@/server/services/public-invitation';
import { formScope } from '@/server/services/live-context';
import { getPublicationState } from '@/server/services/publishing';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Knjiga želja (zahtev 9).
 *
 * Poruke stižu od ljudi bez naloga, pa važe ista pravila kao za RSVP: rok,
 * privatnost i podešavanja sekcije proverava server, a ne interfejs.
 */

export async function submitGuestbookEntryAction(
  input: unknown,
): Promise<ActionResult<{ status: 'pending' | 'approved' }>> {
  try {
    const parsed = guestbookEntrySchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const data = parsed.data;

    // Polje-mamac: vidi objašnjenje u `actions/rsvp.ts`.
    if (data.companyName.trim() !== '') {
      return success({ status: 'pending' });
    }

    const fingerprint = await clientFingerprint();
    const limit = rateLimit(
      `guestbook:${data.slug}:${fingerprint}`,
      RATE_LIMITS.guestbookSubmit,
    );
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše poruka u kratkom roku. Sačekajte pa probajte ponovo.',
      );
    }

    const nonce = checkFormNonce(formScope(data.slug), data.nonce);
    if (nonce === 'too_fast') return success({ status: 'pending' });
    if (nonce !== 'ok') {
      return failure(
        'validation',
        'Obrazac je istekao. Osvežite stranicu i pošaljite poruku ponovo.',
      );
    }

    const store = await cookies();
    const access = await resolvePublicAccess({
      slug: data.slug,
      pinProof: store.get(pinCookieName(data.slug))?.value ?? null,
    });

    if (access.state !== 'ok') {
      return failure('not_found', 'Pozivnica trenutno ne prima poruke.');
    }

    const invitation = access.invitation;
    const section = readGuestbookSection(invitation.document);

    if (!section) {
      return failure('not_found', 'Ova pozivnica nema knjigu želja.');
    }

    if (data.message.length > section.maxMessageLength) {
      return failure('validation', 'Poruka je predugačka.', {
        fieldErrors: {
          message: [`Poruka sme da ima najviše ${section.maxMessageLength} znakova.`],
        },
      });
    }

    const reaction =
      section.allowReactions &&
      (GUESTBOOK_REACTIONS as readonly string[]).includes(data.reaction)
        ? data.reaction
        : null;

    const result = await addGuestbookEntry({
      invitationId: invitation.invitationId,
      authorName: data.authorName,
      message: data.message,
      reaction,
      // Heš otiska, nikad sama adresa - služi samo za prepoznavanje spama.
      ipHash: fingerprint,
      requireApproval: section.requireApproval,
    });

    revalidatePath(`/app/dogadjaji/${invitation.eventId}/knjiga-zelja`);

    // Odobrena poruka se odmah vidi na javnoj stranici, pa keš mora da padne.
    if (result.status === 'approved') revalidateInvitation(invitation.slug);

    return success({ status: result.status });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function moderateEntryAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = moderateEntrySchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await moderateGuestbookEntry(
      parsed.data.eventId,
      parsed.data.entryId,
      parsed.data.status,
    );

    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/knjiga-zelja`);
    await revalidatePublicInvitation(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteEntryAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = deleteEntrySchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'rsvp:manage');

    await deleteGuestbookEntry(parsed.data.eventId, parsed.data.entryId);

    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/knjiga-zelja`);
    await revalidatePublicInvitation(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Svaka moderacija menja ono što gost vidi na javnoj stranici, pa se keš
 * poništava odmah - odobrena poruka koja se pojavi tek za pet minuta izgleda
 * kao da dugme nije radilo.
 */
async function revalidatePublicInvitation(eventId: string): Promise<void> {
  const state = await getPublicationState(eventId);
  if (state) revalidateInvitation(state.slug);
}
