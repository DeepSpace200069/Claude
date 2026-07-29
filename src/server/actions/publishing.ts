'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { pinCookieName } from '@/features/invitations/pin-cookie';
import {
  privacySettingsSchema,
  publishSchema,
  recordShareSchema,
  verifyPinSchema,
} from '@/features/invitations/schemas';
import { requireEventAccess } from '@/server/authz';
import { NotFoundError } from '@/server/authz/errors';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { clientFingerprint } from '@/server/request-info';
import {
  getPublicInvitation,
  isCorrectPin,
  makePinProof,
  recordInvitationShare,
  revalidateInvitation,
} from '@/server/services/public-invitation';
import {
  getPublicationState,
  publishInvitation,
  unpublishInvitation,
  updateInvitationPrivacy,
} from '@/server/services/publishing';
import { recordActivity } from '@/server/services/events';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Objavljivanje, privatnost i deljenje (zahtev 21, 23 i 27).
 *
 * Svaka izmena koja menja ono što gost vidi poništava keš javne stranice
 * (`revalidateInvitation`), pa organizator posle čuvanja odmah vidi novo stanje
 * na javnom linku.
 */

export async function updatePrivacyAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const parsed = privacySettingsSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:publish');

    const result = await updateInvitationPrivacy(parsed.data);
    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/objavljivanje`);

    await recordActivity({
      eventId: parsed.data.eventId,
      actorId: access.user.id,
      kind: 'invitation_edited',
      payload: { action: 'privacy_updated', privacy: parsed.data.privacy },
    });

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function publishInvitationAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const parsed = publishSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Nedostaje identifikator događaja.');
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:publish');

    const limit = rateLimit(`publish:${access.user.id}`, RATE_LIMITS.publish);
    if (!limit.allowed) {
      return failure('rate_limited', 'Previše pokušaja. Sačekajte pa probajte ponovo.');
    }

    const result = await publishInvitation(parsed.data.eventId, access.user.id);

    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/objavljivanje`);

    await recordActivity({
      eventId: parsed.data.eventId,
      actorId: access.user.id,
      kind: 'invitation_published',
    });

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function unpublishInvitationAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const parsed = publishSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Nedostaje identifikator događaja.');
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:publish');

    const result = await unpublishInvitation(parsed.data.eventId);

    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/objavljivanje`);

    await recordActivity({
      eventId: parsed.data.eventId,
      actorId: access.user.id,
      kind: 'invitation_unpublished',
    });

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Unos PIN-a na javnoj stranici.
 *
 * Jedina javna akcija u ovom modulu, pa je i jedina sa ograničenjem po
 * otisku klijenta: PIN je kratak i bez ograničenja bi se pogodio za nekoliko
 * minuta. Odgovor ne otkriva ni da li pozivnica postoji.
 */
export async function verifyPinAction(
  input: unknown,
): Promise<ActionResult<{ unlocked: true }>> {
  try {
    const parsed = verifyPinSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Unesite PIN.');
    }

    const fingerprint = await clientFingerprint();
    const limit = rateLimit(
      `pin:${parsed.data.slug}:${fingerprint}`,
      RATE_LIMITS.pinAttempt,
    );
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše pokušaja. Sačekajte nekoliko minuta pa probajte ponovo.',
      );
    }

    const invitation = await getPublicInvitation(parsed.data.slug);

    if (
      !invitation ||
      invitation.status !== 'published' ||
      invitation.privacy !== 'pin' ||
      !(await isCorrectPin(invitation.invitationId, parsed.data.pin))
    ) {
      return failure('forbidden', 'PIN nije tačan.');
    }

    const proof = await makePinProof(invitation.invitationId);
    if (!proof) return failure('forbidden', 'PIN nije tačan.');

    const store = await cookies();
    store.set(pinCookieName(invitation.slug), proof, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: `/p/${invitation.slug}`,
      maxAge: 60 * 60 * 24 * 30,
    });

    return success({ unlocked: true });
  } catch (error) {
    return toActionFailure(error);
  }
}

/** Beleženje deljenja - zbirno po danu, bez ijednog podatka o gostu. */
export async function recordShareAction(
  input: unknown,
): Promise<ActionResult<{ recorded: true }>> {
  try {
    const parsed = recordShareSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const access = await requireEventAccess(parsed.data.eventId, 'event:view');

    const state = await getPublicationState(parsed.data.eventId, access.user.id);
    if (!state) throw new NotFoundError('Pozivnica ne postoji.');

    const invitation = await getPublicInvitation(state.slug);
    if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

    await recordInvitationShare({
      invitationId: invitation.invitationId,
      timeZone: invitation.timeZone,
    });

    return success({ recorded: true });
  } catch (error) {
    return toActionFailure(error);
  }
}
