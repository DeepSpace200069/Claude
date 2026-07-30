'use server';

import { revalidatePath } from 'next/cache';

import { appUrl } from '@/config/brand';
import {
  createGuestSchema,
  createRecipientSchema,
  deleteGuestSchema,
  deleteHouseholdSchema,
  householdSchema,
  importGuestsSchema,
  revokeRecipientSchema,
  updateGuestSchema,
  updateHouseholdSchema,
} from '@/features/guests/schemas';
import { requireEventAccess } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { recordActivity } from '@/server/services/events';
import {
  createGuest,
  createHousehold,
  deleteGuest,
  deleteHousehold,
  importGuests,
  issueRecipientLink,
  revokeRecipientLink,
  updateGuest,
  updateHousehold,
  type ImportSummary,
} from '@/server/services/guests';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Server akcije za spisak gostiju (zahtev 12 i 13).
 *
 * Svaka akcija prvo prolazi kroz `requireEventAccess`: dozvola `guests:edit`
 * postoji i za ulogu „upravljanje gostima", pa saradnik kome je poveren spisak
 * radi bez pristupa naplati ili objavljivanju (zahtev 39.5).
 */

/** Spisak se čita sa nekoliko stranica, pa se sve osvežava zajedno. */
function revalidateGuestPages(eventId: string): void {
  revalidatePath(`/app/dogadjaji/${eventId}/gosti`);
  revalidatePath(`/app/dogadjaji/${eventId}/odgovori`);
  revalidatePath(`/app/dogadjaji/${eventId}`);
}

export async function createGuestAction(
  input: unknown,
): Promise<ActionResult<{ guestId: string }>> {
  try {
    const parsed = createGuestSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const { eventId, ...guest } = parsed.data;
    const access = await requireEventAccess(eventId, 'guests:edit');

    const limit = rateLimit(`guest:${access.user.id}`, RATE_LIMITS.guestMutation);
    if (!limit.allowed) {
      return failure('rate_limited', 'Previše izmena zaredom. Sačekajte pa nastavite.');
    }

    const result = await createGuest(eventId, guest);
    revalidateGuestPages(eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateGuestAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = updateGuestSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const { eventId, guestId, ...guest } = parsed.data;
    const access = await requireEventAccess(eventId, 'guests:edit');

    const limit = rateLimit(`guest:${access.user.id}`, RATE_LIMITS.guestMutation);
    if (!limit.allowed) {
      return failure('rate_limited', 'Previše izmena zaredom. Sačekajte pa nastavite.');
    }

    await updateGuest(eventId, guestId, guest);
    revalidateGuestPages(eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteGuestAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = deleteGuestSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'guests:edit');

    await deleteGuest(parsed.data.eventId, parsed.data.guestId);
    revalidateGuestPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Domaćinstva ------------------------------------------------------------

export async function createHouseholdAction(
  input: unknown,
): Promise<ActionResult<{ householdId: string }>> {
  try {
    const parsed = householdSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const { eventId, ...household } = parsed.data;
    await requireEventAccess(eventId, 'guests:edit');

    const result = await createHousehold(eventId, household);
    revalidateGuestPages(eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateHouseholdAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = updateHouseholdSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const { eventId, householdId, ...household } = parsed.data;
    await requireEventAccess(eventId, 'guests:edit');

    await updateHousehold(eventId, householdId, household);
    revalidateGuestPages(eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteHouseholdAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = deleteHouseholdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'guests:edit');

    await deleteHousehold(parsed.data.eventId, parsed.data.householdId);
    revalidateGuestPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Personalizovani linkovi ------------------------------------------------

/**
 * Izdavanje ličnog linka.
 *
 * Odgovor sadrži ceo link sa tokenom - jedini put kada ga iko može pročitati.
 * Ako organizator zatvori prozor pre nego što ga kopira, jedini ispravan
 * odgovor je izdati novi link, a ne pokušati da se stari rekonstruiše
 * (zahtev 39.6).
 */
export async function issueRecipientLinkAction(
  input: unknown,
): Promise<ActionResult<{ recipientId: string; url: string }>> {
  try {
    const parsed = createRecipientSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const { eventId, guestId, householdId } = parsed.data;
    const access = await requireEventAccess(eventId, 'guests:edit');

    const limit = rateLimit(`link:${access.user.id}`, RATE_LIMITS.guestMutation);
    if (!limit.allowed) {
      return failure('rate_limited', 'Previše zahteva zaredom. Sačekajte pa nastavite.');
    }

    const issued = await issueRecipientLink({
      eventId,
      guestId: guestId || null,
      householdId: householdId || null,
    });

    revalidateGuestPages(eventId);

    return success({
      recipientId: issued.recipientId,
      url: appUrl(`/p/${issued.slug}/${issued.token}`),
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function revokeRecipientLinkAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = revokeRecipientSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'guests:edit');

    await revokeRecipientLink(parsed.data.eventId, parsed.data.recipientId);
    revalidateGuestPages(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Uvoz -------------------------------------------------------------------

export async function importGuestsAction(
  input: unknown,
): Promise<ActionResult<ImportSummary>> {
  try {
    const parsed = importGuestsSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Izaberite CSV fajl sa spiskom gostiju.');
    }

    const access = await requireEventAccess(parsed.data.eventId, 'guests:edit');

    const limit = rateLimit(`import:${access.user.id}`, RATE_LIMITS.guestImport);
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše uvoza u kratkom roku. Pokušajte ponovo za koji minut.',
      );
    }

    const summary = await importGuests({
      eventId: parsed.data.eventId,
      csv: parsed.data.csv,
      hasHeader: parsed.data.hasHeader,
    });

    revalidateGuestPages(parsed.data.eventId);

    if (summary.created > 0) {
      await recordActivity({
        eventId: parsed.data.eventId,
        actorId: access.user.id,
        kind: 'guest_imported',
        payload: { created: summary.created, skipped: summary.skipped },
      });
    }

    return success(summary);
  } catch (error) {
    return toActionFailure(error);
  }
}
