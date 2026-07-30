import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import { seatAssignments, seatingPlanVersions } from '@/server/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/server/authz/errors';
import { createEvent } from '@/server/services/events';
import { createGuest } from '@/server/services/guests';
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
  ensureSeatingPlan,
  getSeatingPlan,
  moveTable,
  setVersionLock,
  unassignGuest,
  updateTable,
} from '@/server/services/seating';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  raiseGuestLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Raspored sedenja od kraja do kraja.
 *
 * Naglasak je na pravilima koja se ne vide u tipovima: da zaključana verzija
 * odbija svaku izmenu, da gost ne može da sedi za dva stola, da kapacitet
 * zaista zaustavlja deveto mesto za stolom od osam i da kopija verzije ne deli
 * nijedan red sa originalom.
 */
const suite = hasTestDatabase ? describe : describe.skip;

const TABLE = {
  name: 'Sto 1',
  shape: 'round' as const,
  capacity: 2,
  x: 100,
  y: 100,
  width: 120,
  height: 120,
  rotation: 0,
  notes: '',
};

suite('raspored sedenja', () => {
  let userId: string;
  let eventId: string;
  let otherEventId: string;
  let versionId: string;
  let roomId: string;

  const addGuest = async (firstName: string, lastName = 'Ilić', event = eventId) => {
    const { guestId } = await createGuest(event, {
      firstName,
      lastName,
      email: '',
      phone: '',
      isChild: false,
      tags: [],
      privateNote: '',
      householdId: '',
    });
    return guestId;
  };

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    const owner = await createTestUser();
    userId = owner.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Naše venčanje',
      details: {},
      date: '2026-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
    });
    eventId = created.eventId;

    const other = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Druga proslava',
      details: {},
      date: '2026-10-10',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Niš',
      venueName: 'Hotel Tami',
      primaryLocale: 'sr-Latn',
    });
    otherEventId = other.eventId;

    const plan = await ensureSeatingPlan(eventId);
    versionId = plan.versionId;

    const view = await getSeatingPlan(eventId);
    roomId = view.rooms[0]?.id ?? '';
  });

  it('prvi otvor pravi plan sa jednom salom', async () => {
    const view = await getSeatingPlan(eventId);

    expect(view.rooms).toHaveLength(1);
    expect(view.rooms[0]?.tables).toEqual([]);
    expect(view.versions).toHaveLength(1);
    expect(view.versions[0]?.isActive).toBe(true);
    expect(view.isLocked).toBe(false);
  });

  it('ponovljeni poziv ne pravi drugi plan', async () => {
    const first = await ensureSeatingPlan(eventId);
    const second = await ensureSeatingPlan(eventId);

    expect(second.planId).toBe(first.planId);
    expect(second.versionId).toBe(first.versionId);
  });

  it('naziv stola je jedinstven u sali i dobija sufiks umesto greške', async () => {
    await createTable(eventId, roomId, TABLE);
    await createTable(eventId, roomId, TABLE);

    const view = await getSeatingPlan(eventId);
    expect(view.rooms[0]?.tables.map((table) => table.name)).toEqual([
      'Sto 1',
      'Sto 1 (2)',
    ]);
  });

  it('dupliranje kopira izgled, ali ne i goste', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);
    await assignGuest({ eventId, tableId, guestId: await addGuest('Marko') });

    await duplicateTable(eventId, tableId);

    const view = await getSeatingPlan(eventId);
    const [original, copy] = view.rooms[0]?.tables ?? [];

    expect(copy?.capacity).toBe(original?.capacity);
    expect(copy?.x).toBe((original?.x ?? 0) + 40);
    expect(original?.guests).toHaveLength(1);
    // Dva stola sa istim ljudima nisu raspored nego greška.
    expect(copy?.guests).toHaveLength(0);
  });

  it('kapacitet zaustavlja treću osobu za stolom od dvoje', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);

    await assignGuest({ eventId, tableId, guestId: await addGuest('Marko') });
    await assignGuest({ eventId, tableId, guestId: await addGuest('Ana') });

    await expect(
      assignGuest({ eventId, tableId, guestId: await addGuest('Petar') }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('gost sedi za tačno jednim stolom; premeštanje ne pravi duplikat', async () => {
    const first = await createTable(eventId, roomId, TABLE);
    const second = await createTable(eventId, roomId, { ...TABLE, name: 'Sto 2' });
    const guestId = await addGuest('Marko');

    await assignGuest({ eventId, tableId: first.tableId, guestId });
    await assignGuest({ eventId, tableId: second.tableId, guestId });

    const rows = await db
      .select()
      .from(seatAssignments)
      .where(eq(seatAssignments.guestId, guestId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tableId).toBe(second.tableId);
  });

  it('ponovno slanje istog gosta za isti sto ne menja ništa', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);
    const guestId = await addGuest('Marko');

    const first = await assignGuest({ eventId, tableId, guestId });
    const second = await assignGuest({ eventId, tableId, guestId });

    expect(second.assignmentId).toBe(first.assignmentId);
  });

  it('redni brojevi mesta popunjavaju rupe', async () => {
    const { tableId } = await createTable(eventId, roomId, { ...TABLE, capacity: 4 });

    const a = await assignGuest({ eventId, tableId, guestId: await addGuest('A') });
    await assignGuest({ eventId, tableId, guestId: await addGuest('B') });

    await unassignGuest(eventId, a.assignmentId);
    await assignGuest({ eventId, tableId, guestId: await addGuest('C') });

    const view = await getSeatingPlan(eventId);
    const seats = view.rooms[0]?.tables[0]?.guests.map((guest) => guest.seatNumber);

    expect(seats?.sort()).toEqual([1, 2]);
  });

  it('brisanje stola vraća goste među neraspoređene', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);
    await assignGuest({ eventId, tableId, guestId: await addGuest('Marko') });

    await deleteTable(eventId, tableId);

    const view = await getSeatingPlan(eventId);
    expect(view.rooms[0]?.tables).toHaveLength(0);
    expect(view.unseated.map((guest) => guest.name)).toEqual(['Marko Ilić']);
  });

  it('pražnjenje stola uklanja sve goste odjednom', async () => {
    const { tableId } = await createTable(eventId, roomId, { ...TABLE, capacity: 4 });
    await assignGuest({ eventId, tableId, guestId: await addGuest('A') });
    await assignGuest({ eventId, tableId, guestId: await addGuest('B') });

    await clearTable(eventId, tableId);

    const view = await getSeatingPlan(eventId);
    expect(view.rooms[0]?.tables[0]?.guests).toHaveLength(0);
    expect(view.unseated).toHaveLength(2);
  });

  it('raspored mora imati bar jednu salu', async () => {
    await expect(deleteRoom(eventId, roomId)).rejects.toBeInstanceOf(ValidationError);

    await createRoom(eventId, versionId, { name: 'Terasa', width: 800, height: 600 });
    await deleteRoom(eventId, roomId);

    const view = await getSeatingPlan(eventId);
    expect(view.rooms.map((room) => room.name)).toEqual(['Terasa']);
  });

  it('tuđi sto i tuđa sala nisu dostupni', async () => {
    const otherPlan = await ensureSeatingPlan(otherEventId);
    const otherView = await getSeatingPlan(otherEventId);
    const otherRoomId = otherView.rooms[0]?.id ?? '';

    const { tableId } = await createTable(otherEventId, otherRoomId, TABLE);

    await expect(updateTable(eventId, tableId, TABLE)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(deleteTable(eventId, tableId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createRoom(eventId, otherPlan.versionId, { name: 'X', width: 800, height: 600 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('gost sa druge proslave ne može da se rasporedi', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);
    const stranger = await addGuest('Tuđi', 'Gost', otherEventId);

    await expect(
      assignGuest({ eventId, tableId, guestId: stranger }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

suite('zaključavanje i verzije rasporeda', () => {
  let userId: string;
  let eventId: string;
  let versionId: string;
  let roomId: string;

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    const owner = await createTestUser();
    userId = owner.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Naše venčanje',
      details: {},
      date: '2026-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
    });
    eventId = created.eventId;

    const plan = await ensureSeatingPlan(eventId);
    versionId = plan.versionId;

    const view = await getSeatingPlan(eventId);
    roomId = view.rooms[0]?.id ?? '';
  });

  it('zaključana verzija odbija svaku izmenu', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);
    await setVersionLock(eventId, versionId, true);

    await expect(createTable(eventId, roomId, TABLE)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(updateTable(eventId, tableId, TABLE)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      moveTable(eventId, tableId, { x: 10, y: 10 }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(deleteTable(eventId, tableId)).rejects.toBeInstanceOf(ConflictError);
    await expect(
      createRoom(eventId, versionId, { name: 'X', width: 800, height: 600 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('otključavanje vraća mogućnost izmene', async () => {
    await setVersionLock(eventId, versionId, true);
    await setVersionLock(eventId, versionId, false);

    await expect(createTable(eventId, roomId, TABLE)).resolves.toBeDefined();
  });

  it('kopija verzije preuzima sale, stolove i raspored, ali ne deli redove', async () => {
    const { tableId } = await createTable(eventId, roomId, { ...TABLE, capacity: 4 });

    const { guestId } = await createGuest(eventId, {
      firstName: 'Marko',
      lastName: 'Ilić',
      email: '',
      phone: '',
      isChild: false,
      tags: [],
      privateNote: '',
      householdId: '',
    });
    await assignGuest({ eventId, tableId, guestId });

    const copy = await duplicateVersion(eventId, versionId, 'Plan B');

    const view = await getSeatingPlan(eventId);
    expect(view.versionId).toBe(copy.versionId);
    expect(view.versionLabel).toBe('Plan B');
    expect(view.rooms[0]?.tables[0]?.guests.map((guest) => guest.name)).toEqual([
      'Marko Ilić',
    ]);

    // Izmena u kopiji ne sme da dodirne original.
    const copiedTableId = view.rooms[0]?.tables[0]?.id ?? '';
    await clearTable(eventId, copiedTableId);

    const original = await getSeatingPlan(eventId, versionId);
    expect(original.rooms[0]?.tables[0]?.guests).toHaveLength(1);
  });

  it('kopija zaključane verzije se pravi i sama nije zaključana', async () => {
    await setVersionLock(eventId, versionId, true);

    const copy = await duplicateVersion(eventId, versionId, 'Nastavak');
    const view = await getSeatingPlan(eventId, copy.versionId);

    expect(view.isLocked).toBe(false);
  });

  it('poslednja verzija ne može da se obriše', async () => {
    await expect(deleteVersion(eventId, versionId)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('brisanje aktivne verzije prebacuje na preostalu', async () => {
    const copy = await duplicateVersion(eventId, versionId, 'Plan B');

    const result = await deleteVersion(eventId, copy.versionId);
    expect(result.activeVersionId).toBe(versionId);

    const remaining = await db
      .select({ id: seatingPlanVersions.id })
      .from(seatingPlanVersions);
    expect(remaining).toHaveLength(1);
  });
});

suite('upozorenja rasporeda', () => {
  let userId: string;
  let eventId: string;
  let roomId: string;

  const addGuest = async (firstName: string) => {
    const { guestId } = await createGuest(eventId, {
      firstName,
      lastName: 'Ilić',
      email: '',
      phone: '',
      isChild: false,
      tags: [],
      privateNote: '',
      householdId: '',
    });
    return guestId;
  };

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    const owner = await createTestUser();
    userId = owner.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Naše venčanje',
      details: {},
      date: '2026-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
    });
    eventId = created.eventId;

    await ensureSeatingPlan(eventId);
    const view = await getSeatingPlan(eventId);
    roomId = view.rooms[0]?.id ?? '';
  });

  it('smanjenje kapaciteta ispod broja gostiju daje upozorenje, ne grešku', async () => {
    const { tableId } = await createTable(eventId, roomId, { ...TABLE, capacity: 4 });
    await assignGuest({ eventId, tableId, guestId: await addGuest('A') });
    await assignGuest({ eventId, tableId, guestId: await addGuest('B') });

    await updateTable(eventId, tableId, { ...TABLE, capacity: 1 });

    const view = await getSeatingPlan(eventId);
    expect(view.warnings).toEqual([
      {
        kind: 'over_capacity',
        tableId,
        tableName: 'Sto 1',
        seated: 2,
        capacity: 1,
      },
    ]);
  });

  it('„sedi sa" upozorava kad su za različitim stolovima', async () => {
    const first = await createTable(eventId, roomId, TABLE);
    const second = await createTable(eventId, roomId, { ...TABLE, name: 'Sto 2' });

    const a = await addGuest('Ana');
    const b = await addGuest('Bojan');
    await addGuestPreference({ eventId, guestId: a, kind: 'sit_with', relatedGuestId: b });

    await assignGuest({ eventId, tableId: first.tableId, guestId: a });
    await assignGuest({ eventId, tableId: second.tableId, guestId: b });

    const apart = await getSeatingPlan(eventId);
    expect(apart.warnings).toEqual([
      { kind: 'separated', guestName: 'Ana Ilić', otherName: 'Bojan Ilić' },
    ]);

    // Kad sednu zajedno, upozorenja nema.
    await assignGuest({ eventId, tableId: first.tableId, guestId: b });
    const together = await getSeatingPlan(eventId);
    expect(together.warnings).toEqual([]);
  });

  it('„izbegava" upozorava kad su za istim stolom', async () => {
    const { tableId } = await createTable(eventId, roomId, { ...TABLE, capacity: 4 });

    const a = await addGuest('Ana');
    const b = await addGuest('Bojan');
    await addGuestPreference({ eventId, guestId: a, kind: 'avoid', relatedGuestId: b });

    await assignGuest({ eventId, tableId, guestId: a });
    await assignGuest({ eventId, tableId, guestId: b });

    const view = await getSeatingPlan(eventId);
    expect(view.warnings).toEqual([
      {
        kind: 'together',
        guestName: 'Ana Ilić',
        otherName: 'Bojan Ilić',
        tableName: 'Sto 1',
      },
    ]);
  });

  it('pravilo ćuti dok bar jedno od dvoje nije raspoređeno', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);

    const a = await addGuest('Ana');
    const b = await addGuest('Bojan');
    await addGuestPreference({ eventId, guestId: a, kind: 'sit_with', relatedGuestId: b });

    await assignGuest({ eventId, tableId, guestId: a });

    const view = await getSeatingPlan(eventId);
    expect(view.warnings).toEqual([]);
  });

  it('pravilo ne sme da se odnosi na samog gosta', async () => {
    const a = await addGuest('Ana');

    await expect(
      addGuestPreference({ eventId, guestId: a, kind: 'sit_with', relatedGuestId: a }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('posebni zahtevi se vide uz gosta, i raspoređenog i neraspoređenog', async () => {
    const { tableId } = await createTable(eventId, roomId, TABLE);

    const a = await addGuest('Ana');
    const b = await addGuest('Bojan');
    await addGuestPreference({ eventId, guestId: a, kind: 'high_chair' });
    await addGuestPreference({ eventId, guestId: b, kind: 'accessible' });

    await assignGuest({ eventId, tableId, guestId: a });

    const view = await getSeatingPlan(eventId);
    expect(view.rooms[0]?.tables[0]?.guests[0]?.needs).toEqual(['high_chair']);
    expect(view.unseated.find((guest) => guest.id === b)?.needs).toEqual(['accessible']);
  });
});
