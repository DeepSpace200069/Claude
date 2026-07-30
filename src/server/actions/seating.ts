'use server';

import { revalidatePath } from 'next/cache';

import { can } from '@/features/billing/entitlements';
import {
  addPreferenceSchema,
  assignGuestSchema,
  createRoomSchema,
  createTableSchema,
  deleteRoomSchema,
  duplicateVersionSchema,
  moveTableSchema,
  removePreferenceSchema,
  renameVersionSchema,
  setLockSchema,
  tableIdSchema,
  unassignGuestSchema,
  updateRoomSchema,
  updateTableSchema,
  versionIdSchema,
} from '@/features/seating/schemas';
import { requireEventAccess } from '@/server/authz';
import { recordActivity } from '@/server/services/events';
import { getEventEntitlements } from '@/server/services/entitlements';
import {
  addGuestPreference,
  assignGuest,
  clearTable,
  createRoom,
  createTable,
  deleteRoom,
  deleteTable,
  deleteVersion,
  duplicateTable,
  duplicateVersion,
  moveTable,
  removeGuestPreference,
  renameVersion,
  setActiveVersion,
  setVersionLock,
  unassignGuest,
  updateRoom,
  updateTable,
} from '@/server/services/seating';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionFailure,
  type ActionResult,
} from './result';

/**
 * Server akcije rasporeda sedenja (zahtev 14 i 18).
 *
 * Svaka izmena prolazi kroz tri kapije, tim redom: dozvola nad događajem,
 * mogućnost paketa i stanje verzije (zaključana verzija ne prima izmene). Sve
 * tri žive na serveru - interfejs ih ponavlja samo da bi korisnik unapred znao
 * na čemu je (zahtev 24).
 */

/**
 * Raspored sedenja je mogućnost paketa.
 *
 * Vraća se poruka sa nazivom paketa i putem dalje, umesto tihe zabrane: dugme
 * postoji, korisnik zna zašto ne radi i šta da uradi.
 */
async function requireSeatingAccess(
  eventId: string,
): Promise<{ userId: string } | ActionFailure> {
  const access = await requireEventAccess(eventId, 'seating:edit');
  const entitlements = await getEventEntitlements(eventId);

  if (!can(entitlements, 'seating')) {
    return failure(
      'limit_exceeded',
      `Raspored sedenja nije uključen u paket „${entitlements.planName}”.`,
      { details: { feature: 'seating', plan: entitlements.planName } },
    );
  }

  return { userId: access.user.id };
}

function isFailure(value: { userId: string } | ActionFailure): value is ActionFailure {
  return 'ok' in value;
}

function revalidateSeating(eventId: string): void {
  revalidatePath(`/app/dogadjaji/${eventId}/raspored`);
}

// --- Sale -------------------------------------------------------------------

export async function createRoomAction(
  input: unknown,
): Promise<ActionResult<{ roomId: string }>> {
  try {
    const parsed = createRoomSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await createRoom(
      parsed.data.eventId,
      parsed.data.versionId,
      parsed.data.room,
    );
    revalidateSeating(parsed.data.eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateRoomAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = updateRoomSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await updateRoom(parsed.data.eventId, parsed.data.roomId, parsed.data.room);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteRoomAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = deleteRoomSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await deleteRoom(parsed.data.eventId, parsed.data.roomId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Stolovi ----------------------------------------------------------------

export async function createTableAction(
  input: unknown,
): Promise<ActionResult<{ tableId: string }>> {
  try {
    const parsed = createTableSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await createTable(
      parsed.data.eventId,
      parsed.data.roomId,
      parsed.data.table,
    );
    revalidateSeating(parsed.data.eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateTableAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = updateTableSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await updateTable(parsed.data.eventId, parsed.data.tableId, parsed.data.table);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Pomeranje stola.
 *
 * Namerno **ne** poništava keš stranice: poziva se pri svakom puštanju stola, a
 * platno već zna novi položaj. Osvežavanje cele stranice na svaki pomeraj bi
 * uređivač učinilo trzavim.
 */
export async function moveTableAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = moveTableSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await moveTable(parsed.data.eventId, parsed.data.tableId, {
      x: parsed.data.x,
      y: parsed.data.y,
      ...(parsed.data.rotation === undefined ? {} : { rotation: parsed.data.rotation }),
    });

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function duplicateTableAction(
  input: unknown,
): Promise<ActionResult<{ tableId: string }>> {
  try {
    const parsed = tableIdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await duplicateTable(parsed.data.eventId, parsed.data.tableId);
    revalidateSeating(parsed.data.eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteTableAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = tableIdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await deleteTable(parsed.data.eventId, parsed.data.tableId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function clearTableAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = tableIdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await clearTable(parsed.data.eventId, parsed.data.tableId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Raspoređivanje gostiju -------------------------------------------------

export async function assignGuestAction(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  try {
    const parsed = assignGuestSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await assignGuest({
      eventId: parsed.data.eventId,
      tableId: parsed.data.tableId,
      guestId: parsed.data.guestId,
      seatNumber: parsed.data.seatNumber ?? null,
    });

    revalidateSeating(parsed.data.eventId);
    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function unassignGuestAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = unassignGuestSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await unassignGuest(parsed.data.eventId, parsed.data.assignmentId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Verzije ----------------------------------------------------------------

export async function duplicateVersionAction(
  input: unknown,
): Promise<ActionResult<{ versionId: string }>> {
  try {
    const parsed = duplicateVersionSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await duplicateVersion(
      parsed.data.eventId,
      parsed.data.versionId,
      parsed.data.label,
    );

    revalidateSeating(parsed.data.eventId);

    await recordActivity({
      eventId: parsed.data.eventId,
      actorId: gate.userId,
      kind: 'seating_updated',
      payload: { action: 'version_duplicated' },
    });

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function setActiveVersionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = versionIdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await setActiveVersion(parsed.data.eventId, parsed.data.versionId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function setVersionLockAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = setLockSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await setVersionLock(
      parsed.data.eventId,
      parsed.data.versionId,
      parsed.data.isLocked,
    );
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function renameVersionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = renameVersionSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await renameVersion(parsed.data.eventId, parsed.data.versionId, parsed.data.label);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteVersionAction(
  input: unknown,
): Promise<ActionResult<{ activeVersionId: string }>> {
  try {
    const parsed = versionIdSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    const result = await deleteVersion(parsed.data.eventId, parsed.data.versionId);
    revalidateSeating(parsed.data.eventId);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}

// --- Preferencije -----------------------------------------------------------

export async function addPreferenceAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = addPreferenceSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await addGuestPreference({
      eventId: parsed.data.eventId,
      guestId: parsed.data.guestId,
      kind: parsed.data.kind,
      relatedGuestId: parsed.data.relatedGuestId || null,
      note: parsed.data.note,
    });

    revalidateSeating(parsed.data.eventId);
    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function removePreferenceAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = removePreferenceSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const gate = await requireSeatingAccess(parsed.data.eventId);
    if (isFailure(gate)) return gate;

    await removeGuestPreference(parsed.data.eventId, parsed.data.preferenceId);
    revalidateSeating(parsed.data.eventId);

    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}
