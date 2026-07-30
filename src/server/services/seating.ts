import 'server-only';

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db';
import {
  guestPreferences,
  guests,
  rooms,
  seatAssignments,
  seatingPlanVersions,
  seatingPlans,
  tables,
} from '@/server/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/server/authz/errors';

import { listGuests } from './guests';

/**
 * Raspored sedenja (zahtev 14).
 *
 * Model ima tri nivoa: **plan** (jedan po događaju), **verzija** (organizator
 * čuva alternative i vraća se na prethodnu) i unutar verzije **sale** sa
 * stolovima i rasporedom gostiju.
 *
 * Sve izmene idu kroz funkcije koje prvo provere da verzija pripada događaju i
 * da nije zaključana. Zaključavanje koje bi postojalo samo kao sakriveno dugme
 * ne bi značilo ništa (zahtev 24).
 */

export const MAX_TABLE_CAPACITY = 40;
export const ROOM_MIN_SIZE = 400;
export const ROOM_MAX_SIZE = 4000;

export type TableShape =
  | 'round'
  | 'rectangle'
  | 'square'
  | 'oval'
  | 'head'
  | 'zone';

export type SeatedGuest = {
  assignmentId: string;
  guestId: string;
  name: string;
  isChild: boolean;
  seatNumber: number | null;
  /** Posebni zahtevi gosta koje organizator treba da vidi dok raspoređuje. */
  needs: PreferenceKind[];
};

export type PreferenceKind =
  | 'sit_with'
  | 'avoid'
  | 'near_exit'
  | 'kids_table'
  | 'high_chair'
  | 'accessible';

export type SeatingTable = {
  id: string;
  roomId: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  notes: string | null;
  guests: SeatedGuest[];
};

export type SeatingRoom = {
  id: string;
  name: string;
  width: number;
  height: number;
  position: number;
  tables: SeatingTable[];
};

export type UnseatedGuest = {
  id: string;
  name: string;
  isChild: boolean;
  householdName: string | null;
  rsvpStatus: 'pending' | 'yes' | 'no' | 'maybe' | null;
  needs: PreferenceKind[];
};

export type SeatingVersionSummary = {
  id: string;
  version: number;
  label: string | null;
  isLocked: boolean;
  isActive: boolean;
  createdAt: Date;
  tableCount: number;
  seatedCount: number;
};

export type SeatingPlanView = {
  planId: string;
  versionId: string;
  versionNumber: number;
  versionLabel: string | null;
  isLocked: boolean;
  rooms: SeatingRoom[];
  unseated: UnseatedGuest[];
  versions: SeatingVersionSummary[];
  warnings: SeatingWarning[];
};

// --- Plan i verzija ---------------------------------------------------------

/**
 * Plan događaja; pravi se pri prvom otvaranju stranice.
 *
 * Organizator ne treba da klikne „napravi plan" pre nego što uopšte vidi o čemu
 * se radi - prazna sala je bolji početak od praznog ekrana.
 */
export async function ensureSeatingPlan(eventId: string): Promise<{
  planId: string;
  versionId: string;
}> {
  const [existing] = await db
    .select({ id: seatingPlans.id, activeVersionId: seatingPlans.activeVersionId })
    .from(seatingPlans)
    .where(eq(seatingPlans.eventId, eventId))
    .limit(1);

  if (existing?.activeVersionId) {
    return { planId: existing.id, versionId: existing.activeVersionId };
  }

  return db.transaction(async (tx) => {
    const planId =
      existing?.id ??
      (
        await tx
          .insert(seatingPlans)
          .values({ eventId, name: 'Raspored' })
          .returning({ id: seatingPlans.id })
      )[0]?.id;

    if (!planId) throw new Error('Plan rasporeda nije napravljen.');

    const [last] = await tx
      .select({ version: seatingPlanVersions.version })
      .from(seatingPlanVersions)
      .where(eq(seatingPlanVersions.planId, planId))
      .orderBy(desc(seatingPlanVersions.version))
      .limit(1);

    const [version] = await tx
      .insert(seatingPlanVersions)
      .values({ planId, version: (last?.version ?? 0) + 1 })
      .returning({ id: seatingPlanVersions.id });

    if (!version) throw new Error('Verzija rasporeda nije napravljena.');

    await tx.insert(rooms).values({ versionId: version.id, name: 'Sala' });

    await tx
      .update(seatingPlans)
      .set({ activeVersionId: version.id })
      .where(eq(seatingPlans.id, planId));

    return { planId, versionId: version.id };
  });
}

/**
 * Verzija uz proveru da pripada događaju.
 *
 * Ovo je centralna odbrana od IDOR-a u ovom modulu: sve izmene idu preko
 * identifikatora sale, stola ili rasporeda, a svaki od njih se prvo vraća do
 * verzije i do događaja.
 */
async function requireVersion(
  eventId: string,
  versionId: string,
): Promise<{ id: string; planId: string; isLocked: boolean }> {
  const [row] = await db
    .select({
      id: seatingPlanVersions.id,
      planId: seatingPlanVersions.planId,
      isLocked: seatingPlanVersions.isLocked,
    })
    .from(seatingPlanVersions)
    .innerJoin(seatingPlans, eq(seatingPlanVersions.planId, seatingPlans.id))
    .where(
      and(
        eq(seatingPlanVersions.id, versionId),
        eq(seatingPlans.eventId, eventId),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError('Verzija rasporeda ne postoji.');
  return row;
}

/** Verzija koja sme da se menja; zaključana odbija svaku izmenu. */
async function requireEditableVersion(
  eventId: string,
  versionId: string,
): Promise<{ id: string; planId: string }> {
  const version = await requireVersion(eventId, versionId);

  if (version.isLocked) {
    throw new ConflictError(
      'Verzija je zaključana. Otključajte je ili napravite kopiju da biste menjali raspored.',
    );
  }

  return { id: version.id, planId: version.planId };
}

/** Sala uz proveru pripadnosti; vraća i verziju radi provere zaključavanja. */
async function requireRoom(
  eventId: string,
  roomId: string,
): Promise<{ id: string; versionId: string }> {
  const [row] = await db
    .select({ id: rooms.id, versionId: rooms.versionId })
    .from(rooms)
    .innerJoin(seatingPlanVersions, eq(rooms.versionId, seatingPlanVersions.id))
    .innerJoin(seatingPlans, eq(seatingPlanVersions.planId, seatingPlans.id))
    .where(and(eq(rooms.id, roomId), eq(seatingPlans.eventId, eventId)))
    .limit(1);

  if (!row) throw new NotFoundError('Sala ne postoji.');
  return row;
}

async function requireTable(
  eventId: string,
  tableId: string,
): Promise<{ id: string; roomId: string; versionId: string; capacity: number }> {
  const [row] = await db
    .select({
      id: tables.id,
      roomId: tables.roomId,
      versionId: rooms.versionId,
      capacity: tables.capacity,
    })
    .from(tables)
    .innerJoin(rooms, eq(tables.roomId, rooms.id))
    .innerJoin(seatingPlanVersions, eq(rooms.versionId, seatingPlanVersions.id))
    .innerJoin(seatingPlans, eq(seatingPlanVersions.planId, seatingPlans.id))
    .where(and(eq(tables.id, tableId), eq(seatingPlans.eventId, eventId)))
    .limit(1);

  if (!row) throw new NotFoundError('Sto ne postoji.');
  return row;
}

// --- Čitanje ----------------------------------------------------------------

/**
 * Ceo raspored za prikaz i uređivanje.
 *
 * Pet upita bez obzira na broj stolova i gostiju: sale, stolovi, raspoređeni
 * gosti, neraspoređeni gosti i preferencije. Raspored sa dvesta gostiju ne sme
 * da postane N+1 (zahtev 32).
 */
export async function getSeatingPlan(
  eventId: string,
  versionId?: string,
): Promise<SeatingPlanView> {
  const { planId, versionId: activeVersionId } = await ensureSeatingPlan(eventId);
  const targetId = versionId ?? activeVersionId;

  const version = await requireVersion(eventId, targetId);

  const [meta] = await db
    .select({
      version: seatingPlanVersions.version,
      label: seatingPlanVersions.label,
      isLocked: seatingPlanVersions.isLocked,
    })
    .from(seatingPlanVersions)
    .where(eq(seatingPlanVersions.id, version.id))
    .limit(1);

  const roomRows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      width: rooms.width,
      height: rooms.height,
      position: rooms.position,
    })
    .from(rooms)
    .where(eq(rooms.versionId, version.id))
    .orderBy(asc(rooms.position), asc(rooms.createdAt));

  const roomIds = roomRows.map((room) => room.id);

  const tableRows =
    roomIds.length === 0
      ? []
      : await db
          .select({
            id: tables.id,
            roomId: tables.roomId,
            name: tables.name,
            shape: tables.shape,
            capacity: tables.capacity,
            x: tables.x,
            y: tables.y,
            width: tables.width,
            height: tables.height,
            rotation: tables.rotation,
            notes: tables.notes,
          })
          .from(tables)
          .where(inArray(tables.roomId, roomIds))
          .orderBy(asc(tables.name));

  const tableIds = tableRows.map((table) => table.id);

  const assignmentRows =
    tableIds.length === 0
      ? []
      : await db
          .select({
            assignmentId: seatAssignments.id,
            tableId: seatAssignments.tableId,
            guestId: guests.id,
            firstName: guests.firstName,
            lastName: guests.lastName,
            isChild: guests.isChild,
            seatNumber: seatAssignments.seatNumber,
          })
          .from(seatAssignments)
          .innerJoin(guests, eq(seatAssignments.guestId, guests.id))
          .where(
            and(inArray(seatAssignments.tableId, tableIds), isNull(guests.deletedAt)),
          )
          .orderBy(asc(seatAssignments.seatNumber), asc(guests.lastName));

  const seatedIds = new Set(assignmentRows.map((row) => row.guestId));
  const needs = await loadGuestNeeds(eventId);

  const byRoom = new Map<string, SeatingTable[]>();
  for (const table of tableRows) {
    const list = byRoom.get(table.roomId) ?? [];
    list.push({
      ...table,
      guests: assignmentRows
        .filter((row) => row.tableId === table.id)
        .map((row) => ({
          assignmentId: row.assignmentId,
          guestId: row.guestId,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
          isChild: row.isChild,
          seatNumber: row.seatNumber,
          needs: needs.get(row.guestId) ?? [],
        })),
    });
    byRoom.set(table.roomId, list);
  }

  const roomViews: SeatingRoom[] = roomRows.map((room) => ({
    ...room,
    tables: byRoom.get(room.id) ?? [],
  }));

  const unseated = await loadUnseatedGuests(eventId, seatedIds, needs);
  const versions = await listVersions(planId, activeVersionId);

  return {
    planId,
    versionId: version.id,
    versionNumber: meta?.version ?? 1,
    versionLabel: meta?.label ?? null,
    isLocked: meta?.isLocked ?? false,
    rooms: roomViews,
    unseated,
    versions,
    warnings: await evaluateSeating(eventId, roomViews),
  };
}

/** Posebni zahtevi po gostu (stolica za bebe, pristupačnost, dečji sto…). */
async function loadGuestNeeds(
  eventId: string,
): Promise<Map<string, PreferenceKind[]>> {
  const rows = await db
    .select({ guestId: guestPreferences.guestId, kind: guestPreferences.kind })
    .from(guestPreferences)
    .innerJoin(guests, eq(guestPreferences.guestId, guests.id))
    .where(and(eq(guests.eventId, eventId), isNull(guests.deletedAt)));

  const map = new Map<string, PreferenceKind[]>();
  for (const row of rows) {
    // Odnosi (`sit_with`, `avoid`) se ne prikazuju kao značka uz gosta - oni su
    // pravilo između dvoje ljudi i vide se kroz upozorenja.
    if (row.kind === 'sit_with' || row.kind === 'avoid') continue;

    const list = map.get(row.guestId) ?? [];
    list.push(row.kind);
    map.set(row.guestId, list);
  }
  return map;
}

async function loadUnseatedGuests(
  eventId: string,
  seatedIds: ReadonlySet<string>,
  needs: ReadonlyMap<string, PreferenceKind[]>,
): Promise<UnseatedGuest[]> {
  const all = await listGuests(eventId, { odgovor: 'svi', redosled: 'prezime' });

  return all
    .filter((guest) => !seatedIds.has(guest.id))
    .map((guest) => ({
      id: guest.id,
      name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
      isChild: guest.isChild,
      householdName: guest.householdName,
      rsvpStatus: guest.rsvpStatus,
      needs: needs.get(guest.id) ?? [],
    }));
}

async function listVersions(
  planId: string,
  activeVersionId: string,
): Promise<SeatingVersionSummary[]> {
  const rows = await db.execute<{
    id: string;
    version: number;
    label: string | null;
    is_locked: boolean;
    created_at: Date;
    table_count: number;
    seated_count: number;
  }>(sql`
    select
      v.id, v.version, v.label, v.is_locked, v.created_at,
      (select count(*)::int from tables t
        join rooms r on t.room_id = r.id
        where r.version_id = v.id) as table_count,
      (select count(*)::int from seat_assignments a
        join tables t on a.table_id = t.id
        join rooms r on t.room_id = r.id
        where r.version_id = v.id) as seated_count
    from seating_plan_versions v
    where v.plan_id = ${planId}
    order by v.version desc
  `);

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    label: row.label,
    isLocked: row.is_locked,
    isActive: row.id === activeVersionId,
    createdAt: row.created_at,
    tableCount: row.table_count,
    seatedCount: row.seated_count,
  }));
}

// --- Upozorenja -------------------------------------------------------------

export type SeatingWarning =
  | { kind: 'over_capacity'; tableId: string; tableName: string; seated: number; capacity: number }
  | { kind: 'separated'; guestName: string; otherName: string }
  | { kind: 'together'; guestName: string; otherName: string; tableName: string };

/**
 * Upozorenja, nikad zabrane.
 *
 * Organizator zna svoju porodicu bolje od nas. Pravila `sit_with` i `avoid` su
 * podsetnik, a ne prepreka - raspored koji se ne može sačuvati zbog jednog
 * pravila bio bi gori od rasporeda sa žutim upozorenjem.
 */
export async function evaluateSeating(
  eventId: string,
  roomViews: readonly SeatingRoom[],
): Promise<SeatingWarning[]> {
  const warnings: SeatingWarning[] = [];

  const tableByGuest = new Map<string, { name: string; guests: SeatedGuest[] }>();
  for (const room of roomViews) {
    for (const table of room.tables) {
      if (table.guests.length > table.capacity) {
        warnings.push({
          kind: 'over_capacity',
          tableId: table.id,
          tableName: table.name,
          seated: table.guests.length,
          capacity: table.capacity,
        });
      }
      for (const guest of table.guests) {
        tableByGuest.set(guest.guestId, { name: table.name, guests: table.guests });
      }
    }
  }

  const relations = await db
    .select({
      kind: guestPreferences.kind,
      guestId: guestPreferences.guestId,
      relatedGuestId: guestPreferences.relatedGuestId,
      firstName: guests.firstName,
      lastName: guests.lastName,
    })
    .from(guestPreferences)
    .innerJoin(guests, eq(guestPreferences.guestId, guests.id))
    .where(
      and(
        eq(guests.eventId, eventId),
        isNull(guests.deletedAt),
        inArray(guestPreferences.kind, ['sit_with', 'avoid']),
      ),
    );

  if (relations.length === 0) return warnings;

  const relatedIds = relations.flatMap((row) =>
    row.relatedGuestId ? [row.relatedGuestId] : [],
  );

  const relatedNames = new Map<string, string>();
  if (relatedIds.length > 0) {
    const rows = await db
      .select({ id: guests.id, firstName: guests.firstName, lastName: guests.lastName })
      .from(guests)
      .where(inArray(guests.id, relatedIds));

    for (const row of rows) {
      relatedNames.set(row.id, [row.firstName, row.lastName].filter(Boolean).join(' '));
    }
  }

  for (const relation of relations) {
    if (!relation.relatedGuestId) continue;

    const here = tableByGuest.get(relation.guestId);
    const there = tableByGuest.get(relation.relatedGuestId);

    // Dok bar jedno od dvoje nije raspoređeno, pravilo još nije prekršeno.
    if (!here || !there) continue;

    const guestName = [relation.firstName, relation.lastName].filter(Boolean).join(' ');
    const otherName = relatedNames.get(relation.relatedGuestId) ?? '';

    if (relation.kind === 'sit_with' && here.name !== there.name) {
      warnings.push({ kind: 'separated', guestName, otherName });
    }

    if (relation.kind === 'avoid' && here.name === there.name) {
      warnings.push({
        kind: 'together',
        guestName,
        otherName,
        tableName: here.name,
      });
    }
  }

  return warnings;
}

// --- Sale -------------------------------------------------------------------

export async function createRoom(
  eventId: string,
  versionId: string,
  input: { name: string; width: number; height: number },
): Promise<{ roomId: string }> {
  await requireEditableVersion(eventId, versionId);

  const [last] = await db
    .select({ position: rooms.position })
    .from(rooms)
    .where(eq(rooms.versionId, versionId))
    .orderBy(desc(rooms.position))
    .limit(1);

  const [room] = await db
    .insert(rooms)
    .values({
      versionId,
      name: input.name,
      width: clamp(input.width, ROOM_MIN_SIZE, ROOM_MAX_SIZE),
      height: clamp(input.height, ROOM_MIN_SIZE, ROOM_MAX_SIZE),
      position: (last?.position ?? -1) + 1,
    })
    .returning({ id: rooms.id });

  if (!room) throw new Error('Sala nije napravljena.');
  return { roomId: room.id };
}

export async function updateRoom(
  eventId: string,
  roomId: string,
  input: { name: string; width: number; height: number },
): Promise<void> {
  const room = await requireRoom(eventId, roomId);
  await requireEditableVersion(eventId, room.versionId);

  await db
    .update(rooms)
    .set({
      name: input.name,
      width: clamp(input.width, ROOM_MIN_SIZE, ROOM_MAX_SIZE),
      height: clamp(input.height, ROOM_MIN_SIZE, ROOM_MAX_SIZE),
    })
    .where(eq(rooms.id, roomId));
}

/**
 * Brisanje sale briše i stolove u njoj (`ON DELETE CASCADE`), pa i raspored
 * gostiju za tim stolovima. Gosti se time vraćaju među neraspoređene - nijedan
 * gost se ne gubi.
 */
export async function deleteRoom(eventId: string, roomId: string): Promise<void> {
  const room = await requireRoom(eventId, roomId);
  await requireEditableVersion(eventId, room.versionId);

  const remaining = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.versionId, room.versionId));

  if (remaining.length <= 1) {
    throw new ValidationError('Raspored mora imati bar jednu salu.');
  }

  await db.delete(rooms).where(eq(rooms.id, roomId));
}

// --- Stolovi ----------------------------------------------------------------

export type TableInput = {
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  notes: string;
};

export async function createTable(
  eventId: string,
  roomId: string,
  input: TableInput,
): Promise<{ tableId: string }> {
  const room = await requireRoom(eventId, roomId);
  await requireEditableVersion(eventId, room.versionId);

  const name = await uniqueTableName(roomId, input.name);

  const [table] = await db
    .insert(tables)
    .values({ ...normalizeTable(input), roomId, name })
    .returning({ id: tables.id });

  if (!table) throw new Error('Sto nije napravljen.');
  return { tableId: table.id };
}

export async function updateTable(
  eventId: string,
  tableId: string,
  input: TableInput,
): Promise<void> {
  const table = await requireTable(eventId, tableId);
  await requireEditableVersion(eventId, table.versionId);

  const name = await uniqueTableName(table.roomId, input.name, tableId);

  await db
    .update(tables)
    .set({ ...normalizeTable(input), name })
    .where(eq(tables.id, tableId));
}

/**
 * Pomeranje stola po platnu.
 *
 * Odvojeno od `updateTable` jer se dešava desetinama puta dok organizator vuče
 * sto: piše samo dve kolone i ne dira ime, pa ne može da se sudari sa
 * proverom jedinstvenosti naziva.
 */
export async function moveTable(
  eventId: string,
  tableId: string,
  position: { x: number; y: number; rotation?: number },
): Promise<void> {
  const table = await requireTable(eventId, tableId);
  await requireEditableVersion(eventId, table.versionId);

  await db
    .update(tables)
    .set({
      x: Math.round(position.x),
      y: Math.round(position.y),
      ...(position.rotation === undefined
        ? {}
        : { rotation: normalizeRotation(position.rotation) }),
    })
    .where(eq(tables.id, tableId));
}

/**
 * Dupliranje stola.
 *
 * Kopira se izgled i kapacitet, **ne i gosti**: dva stola sa istim ljudima nisu
 * raspored nego greška. Novi sto se pomera dole-desno da ne bi stajao tačno
 * preko originala.
 */
export async function duplicateTable(
  eventId: string,
  tableId: string,
): Promise<{ tableId: string }> {
  const table = await requireTable(eventId, tableId);
  await requireEditableVersion(eventId, table.versionId);

  const [source] = await db.select().from(tables).where(eq(tables.id, tableId)).limit(1);
  if (!source) throw new NotFoundError('Sto ne postoji.');

  const [created] = await db
    .insert(tables)
    .values({
      roomId: source.roomId,
      name: await uniqueTableName(source.roomId, source.name),
      shape: source.shape,
      capacity: source.capacity,
      x: source.x + 40,
      y: source.y + 40,
      width: source.width,
      height: source.height,
      rotation: source.rotation,
      notes: source.notes,
    })
    .returning({ id: tables.id });

  if (!created) throw new Error('Sto nije dupliran.');
  return { tableId: created.id };
}

export async function deleteTable(eventId: string, tableId: string): Promise<void> {
  const table = await requireTable(eventId, tableId);
  await requireEditableVersion(eventId, table.versionId);

  // Gosti sa obrisanog stola se vraćaju u listu neraspoređenih (CASCADE).
  await db.delete(tables).where(eq(tables.id, tableId));
}

/**
 * Naziv stola je jedinstven u sali (i baza to traži).
 *
 * Umesto greške „naziv je zauzet" pri dupliranju, naziv dobija sufiks. Kod
 * ručnog unosa isto pravilo znači da organizator nikad ne ostane bez sačuvane
 * izmene zbog imena.
 */
async function uniqueTableName(
  roomId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const existing = await db
    .select({ id: tables.id, name: tables.name })
    .from(tables)
    .where(eq(tables.roomId, roomId));

  const taken = new Set(
    existing.filter((row) => row.id !== excludeId).map((row) => row.name),
  );

  if (!taken.has(desired)) return desired;

  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${desired} (${suffix})`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new ValidationError('Previše stolova sa istim nazivom.');
}

function normalizeTable(input: TableInput) {
  return {
    shape: input.shape,
    capacity: clamp(input.capacity, 1, MAX_TABLE_CAPACITY),
    x: Math.round(input.x),
    y: Math.round(input.y),
    width: clamp(Math.round(input.width), 40, 800),
    height: clamp(Math.round(input.height), 40, 800),
    rotation: normalizeRotation(input.rotation),
    notes: input.notes.trim() === '' ? null : input.notes.trim(),
  };
}

function normalizeRotation(value: number): number {
  const rounded = Math.round(value) % 360;
  return rounded < 0 ? rounded + 360 : rounded;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- Raspoređivanje gostiju -------------------------------------------------

/**
 * Stavlja gosta za sto.
 *
 * Gost može da sedi samo za jednim stolom u istoj verziji, pa se ranije mesto
 * uklanja u istoj transakciji - premeštanje je jedna radnja, ne „skloni pa
 * dodaj" koje bi u međuvremenu moglo da padne.
 *
 * Kapacitet je granica: deveta osoba ne sme za sto od osam. Ako organizator
 * hoće više, poveća kapacitet stola - to je svesna izmena, a ne slučajno
 * prekoračenje.
 */
export async function assignGuest(input: {
  eventId: string;
  tableId: string;
  guestId: string;
  seatNumber?: number | null;
}): Promise<{ assignmentId: string }> {
  const table = await requireTable(input.eventId, input.tableId);
  await requireEditableVersion(input.eventId, table.versionId);

  const [guest] = await db
    .select({ id: guests.id })
    .from(guests)
    .where(
      and(
        eq(guests.id, input.guestId),
        eq(guests.eventId, input.eventId),
        isNull(guests.deletedAt),
      ),
    )
    .limit(1);

  if (!guest) throw new NotFoundError('Gost ne postoji.');

  return db.transaction(async (tx) => {
    const seatedElsewhere = await tx
      .select({ id: seatAssignments.id, tableId: seatAssignments.tableId })
      .from(seatAssignments)
      .innerJoin(tables, eq(seatAssignments.tableId, tables.id))
      .innerJoin(rooms, eq(tables.roomId, rooms.id))
      .where(
        and(
          eq(seatAssignments.guestId, input.guestId),
          eq(rooms.versionId, table.versionId),
        ),
      );

    const alreadyHere = seatedElsewhere.find((row) => row.tableId === input.tableId);
    if (alreadyHere) return { assignmentId: alreadyHere.id };

    for (const row of seatedElsewhere) {
      await tx.delete(seatAssignments).where(eq(seatAssignments.id, row.id));
    }

    const current = await tx
      .select({ seatNumber: seatAssignments.seatNumber })
      .from(seatAssignments)
      .where(eq(seatAssignments.tableId, input.tableId));

    if (current.length >= table.capacity) {
      throw new ValidationError(
        `Za sto staje najviše ${table.capacity} osoba. Povećajte kapacitet ili izaberite drugi sto.`,
      );
    }

    const [created] = await tx
      .insert(seatAssignments)
      .values({
        tableId: input.tableId,
        guestId: input.guestId,
        seatNumber:
          input.seatNumber ?? nextFreeSeat(current.map((row) => row.seatNumber)),
      })
      .returning({ id: seatAssignments.id });

    if (!created) throw new Error('Gost nije raspoređen.');
    return { assignmentId: created.id };
  });
}

/** Prvi slobodan redni broj mesta; rupe se popunjavaju pre nego što se raste. */
function nextFreeSeat(taken: ReadonlyArray<number | null>): number {
  const used = new Set(taken.filter((value): value is number => value !== null));
  let seat = 1;
  while (used.has(seat)) seat += 1;
  return seat;
}

export async function unassignGuest(
  eventId: string,
  assignmentId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: seatAssignments.id, versionId: rooms.versionId })
    .from(seatAssignments)
    .innerJoin(tables, eq(seatAssignments.tableId, tables.id))
    .innerJoin(rooms, eq(tables.roomId, rooms.id))
    .innerJoin(seatingPlanVersions, eq(rooms.versionId, seatingPlanVersions.id))
    .innerJoin(seatingPlans, eq(seatingPlanVersions.planId, seatingPlans.id))
    .where(and(eq(seatAssignments.id, assignmentId), eq(seatingPlans.eventId, eventId)))
    .limit(1);

  if (!row) throw new NotFoundError('Raspored ne postoji.');

  await requireEditableVersion(eventId, row.versionId);
  await db.delete(seatAssignments).where(eq(seatAssignments.id, assignmentId));
}

/** Uklanja sve goste sa stola - brže nego jedan po jedan pri preuređivanju. */
export async function clearTable(eventId: string, tableId: string): Promise<void> {
  const table = await requireTable(eventId, tableId);
  await requireEditableVersion(eventId, table.versionId);

  await db.delete(seatAssignments).where(eq(seatAssignments.tableId, tableId));
}

// --- Verzije ----------------------------------------------------------------

/**
 * Kopija cele verzije.
 *
 * Ovo je jedini način da organizator proba alternativu bez straha: original
 * ostaje netaknut, a kopija postaje aktivna. Kopiraju se sale, stolovi i
 * raspored - sve što čini raspored rasporedom.
 */
export async function duplicateVersion(
  eventId: string,
  versionId: string,
  label: string,
): Promise<{ versionId: string }> {
  const source = await requireVersion(eventId, versionId);

  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ version: seatingPlanVersions.version })
      .from(seatingPlanVersions)
      .where(eq(seatingPlanVersions.planId, source.planId))
      .orderBy(desc(seatingPlanVersions.version))
      .limit(1);

    const [created] = await tx
      .insert(seatingPlanVersions)
      .values({
        planId: source.planId,
        version: (last?.version ?? 0) + 1,
        label: label.trim() === '' ? null : label.trim(),
      })
      .returning({ id: seatingPlanVersions.id });

    if (!created) throw new Error('Verzija nije napravljena.');

    const sourceRooms = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.versionId, versionId))
      .orderBy(asc(rooms.position));

    for (const room of sourceRooms) {
      const [newRoom] = await tx
        .insert(rooms)
        .values({
          versionId: created.id,
          name: room.name,
          width: room.width,
          height: room.height,
          position: room.position,
        })
        .returning({ id: rooms.id });

      if (!newRoom) continue;

      const sourceTables = await tx
        .select()
        .from(tables)
        .where(eq(tables.roomId, room.id));

      for (const table of sourceTables) {
        const [newTable] = await tx
          .insert(tables)
          .values({
            roomId: newRoom.id,
            name: table.name,
            shape: table.shape,
            capacity: table.capacity,
            x: table.x,
            y: table.y,
            width: table.width,
            height: table.height,
            rotation: table.rotation,
            notes: table.notes,
          })
          .returning({ id: tables.id });

        if (!newTable) continue;

        const assignments = await tx
          .select()
          .from(seatAssignments)
          .where(eq(seatAssignments.tableId, table.id));

        if (assignments.length > 0) {
          await tx.insert(seatAssignments).values(
            assignments.map((assignment) => ({
              tableId: newTable.id,
              guestId: assignment.guestId,
              seatNumber: assignment.seatNumber,
            })),
          );
        }
      }
    }

    await tx
      .update(seatingPlans)
      .set({ activeVersionId: created.id })
      .where(eq(seatingPlans.id, source.planId));

    return { versionId: created.id };
  });
}

export async function setActiveVersion(
  eventId: string,
  versionId: string,
): Promise<void> {
  const version = await requireVersion(eventId, versionId);

  await db
    .update(seatingPlans)
    .set({ activeVersionId: version.id })
    .where(eq(seatingPlans.id, version.planId));
}

export async function setVersionLock(
  eventId: string,
  versionId: string,
  isLocked: boolean,
): Promise<void> {
  const version = await requireVersion(eventId, versionId);

  await db
    .update(seatingPlanVersions)
    .set({ isLocked, lockedAt: isLocked ? new Date() : null })
    .where(eq(seatingPlanVersions.id, version.id));
}

export async function renameVersion(
  eventId: string,
  versionId: string,
  label: string,
): Promise<void> {
  const version = await requireVersion(eventId, versionId);

  await db
    .update(seatingPlanVersions)
    .set({ label: label.trim() === '' ? null : label.trim() })
    .where(eq(seatingPlanVersions.id, version.id));
}

export async function deleteVersion(
  eventId: string,
  versionId: string,
): Promise<{ activeVersionId: string }> {
  const version = await requireVersion(eventId, versionId);

  const all = await db
    .select({ id: seatingPlanVersions.id, version: seatingPlanVersions.version })
    .from(seatingPlanVersions)
    .where(eq(seatingPlanVersions.planId, version.planId))
    .orderBy(desc(seatingPlanVersions.version));

  if (all.length <= 1) {
    throw new ValidationError('Poslednja verzija rasporeda ne može da se obriše.');
  }

  const fallback = all.find((row) => row.id !== versionId);
  if (!fallback) throw new ValidationError('Nema verzije na koju bismo se vratili.');

  await db.transaction(async (tx) => {
    await tx
      .update(seatingPlans)
      .set({ activeVersionId: fallback.id })
      .where(eq(seatingPlans.id, version.planId));

    await tx.delete(seatingPlanVersions).where(eq(seatingPlanVersions.id, versionId));
  });

  return { activeVersionId: fallback.id };
}

// --- Preferencije -----------------------------------------------------------

export async function addGuestPreference(input: {
  eventId: string;
  guestId: string;
  kind: PreferenceKind;
  relatedGuestId?: string | null;
  note?: string;
}): Promise<void> {
  const needsRelation = input.kind === 'sit_with' || input.kind === 'avoid';

  if (needsRelation && !input.relatedGuestId) {
    throw new ValidationError('Izaberite gosta na koga se pravilo odnosi.');
  }

  if (input.relatedGuestId === input.guestId) {
    throw new ValidationError('Pravilo mora da se odnosi na drugog gosta.');
  }

  const ids = [input.guestId, ...(input.relatedGuestId ? [input.relatedGuestId] : [])];

  const found = await db
    .select({ id: guests.id })
    .from(guests)
    .where(
      and(
        inArray(guests.id, ids),
        eq(guests.eventId, input.eventId),
        isNull(guests.deletedAt),
      ),
    );

  if (found.length !== ids.length) throw new NotFoundError('Gost ne postoji.');

  await db
    .insert(guestPreferences)
    .values({
      guestId: input.guestId,
      kind: input.kind,
      relatedGuestId: needsRelation ? (input.relatedGuestId ?? null) : null,
      note: input.note?.trim() || null,
    })
    .onConflictDoNothing();
}

export async function removeGuestPreference(
  eventId: string,
  preferenceId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: guestPreferences.id })
    .from(guestPreferences)
    .innerJoin(guests, eq(guestPreferences.guestId, guests.id))
    .where(and(eq(guestPreferences.id, preferenceId), eq(guests.eventId, eventId)))
    .limit(1);

  if (!row) throw new NotFoundError('Pravilo ne postoji.');

  await db.delete(guestPreferences).where(eq(guestPreferences.id, preferenceId));
}

export type PreferenceRow = {
  id: string;
  guestId: string;
  guestName: string;
  kind: PreferenceKind;
  relatedGuestId: string | null;
  relatedName: string | null;
  note: string | null;
};

export async function listGuestPreferences(
  eventId: string,
): Promise<PreferenceRow[]> {
  const rows = await db.execute<{
    id: string;
    guest_id: string;
    guest_name: string;
    kind: PreferenceKind;
    related_guest_id: string | null;
    related_name: string | null;
    note: string | null;
  }>(sql`
    select
      p.id, p.kind, p.note,
      p.guest_id,
      trim(concat_ws(' ', g.first_name, g.last_name)) as guest_name,
      p.related_guest_id,
      trim(concat_ws(' ', r.first_name, r.last_name)) as related_name
    from guest_preferences p
    join guests g on p.guest_id = g.id
    left join guests r on p.related_guest_id = r.id
    where g.event_id = ${eventId} and g.deleted_at is null
    order by guest_name, p.kind
  `);

  return rows.map((row) => ({
    id: row.id,
    guestId: row.guest_id,
    guestName: row.guest_name,
    kind: row.kind,
    relatedGuestId: row.related_guest_id,
    relatedName: row.related_name,
    note: row.note,
  }));
}
