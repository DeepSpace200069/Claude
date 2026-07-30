import 'server-only';

import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';

import { checkLimit } from '@/features/billing/entitlements';
import type { GuestFilters, GuestInput } from '@/features/guests/schemas';
import { RECIPIENT_TOKEN_LENGTH, hashToken, randomToken } from '@/lib/ids';
import { matchColumn, parseCsv } from '@/lib/csv';
import { db } from '@/server/db';
import {
  guestHouseholds,
  guests,
  invitationRecipients,
  invitations,
  rsvpResponses,
} from '@/server/db/schema';
import { LimitExceededError, NotFoundError, ValidationError } from '@/server/authz/errors';

import { getUserEntitlements } from './entitlements';

/**
 * Spisak gostiju (zahtev 12).
 *
 * Podaci gostiju su najosetljiviji deo aplikacije: imena, telefoni i privatne
 * beleške koje gost nikad ne vidi. Zato svaki upit ovde ide **uz `eventId`**,
 * čak i kada je identifikator gosta jedinstven - tako nijedna greška u
 * pozivaocu ne može da dohvati tuđeg gosta (zahtev 24 i 39.8).
 */

export type GuestRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isChild: boolean;
  tags: string[];
  privateNote: string | null;
  householdId: string | null;
  householdName: string | null;
  createdAt: Date;
  /** Odgovor stiže preko personalizovanog linka, ako ga gost ima. */
  rsvpStatus: 'pending' | 'yes' | 'no' | 'maybe' | null;
  recipientId: string | null;
  hasLink: boolean;
};

export type HouseholdRow = {
  id: string;
  name: string;
  maxGuests: number | null;
  notes: string | null;
  guestCount: number;
  recipientId: string | null;
};

/**
 * Lista gostiju sa stanjem odgovora.
 *
 * Jedan upit sa spajanjima umesto liste pa dopune: spisak gostiju se otvara
 * često i lako bi postao N+1 (zahtev 32).
 */
export async function listGuests(
  eventId: string,
  filters: GuestFilters,
): Promise<GuestRow[]> {
  const conditions = [eq(guests.eventId, eventId), isNull(guests.deletedAt)];

  if (filters.pretraga) {
    const pattern = `%${filters.pretraga}%`;
    const search = or(
      ilike(guests.firstName, pattern),
      ilike(guests.lastName, pattern),
      ilike(guests.email, pattern),
      ilike(guests.phone, pattern),
    );
    if (search) conditions.push(search);
  }

  if (filters.oznaka) {
    // `?` proverava postojanje ključa u JSONB nizu bez učitavanja u aplikaciju.
    conditions.push(sql`${guests.tags} ? ${filters.oznaka}`);
  }

  const rows = await db
    .select({
      id: guests.id,
      firstName: guests.firstName,
      lastName: guests.lastName,
      email: guests.email,
      phone: guests.phone,
      isChild: guests.isChild,
      tags: guests.tags,
      privateNote: guests.privateNote,
      householdId: guests.householdId,
      householdName: guestHouseholds.name,
      createdAt: guests.createdAt,
      rsvpStatus: rsvpResponses.status,
      recipientId: invitationRecipients.id,
      recipientRevokedAt: invitationRecipients.revokedAt,
    })
    .from(guests)
    .leftJoin(guestHouseholds, eq(guests.householdId, guestHouseholds.id))
    .leftJoin(
      invitationRecipients,
      and(
        eq(invitationRecipients.guestId, guests.id),
        isNull(invitationRecipients.revokedAt),
      ),
    )
    .leftJoin(rsvpResponses, eq(rsvpResponses.recipientId, invitationRecipients.id))
    .where(and(...conditions))
    .orderBy(
      ...(filters.redosled === 'najnoviji'
        ? [desc(guests.createdAt)]
        : filters.redosled === 'ime'
          ? [asc(guests.firstName), asc(guests.lastName)]
          : [asc(guests.lastName), asc(guests.firstName)]),
    );

  const mapped: GuestRow[] = rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    isChild: row.isChild,
    tags: row.tags,
    privateNote: row.privateNote,
    householdId: row.householdId,
    householdName: row.householdName,
    createdAt: row.createdAt,
    rsvpStatus: row.rsvpStatus,
    recipientId: row.recipientId,
    hasLink: row.recipientId !== null && row.recipientRevokedAt === null,
  }));

  // Filtriranje po odgovoru ide u aplikaciji: „bez odgovora" obuhvata i goste
  // koji nemaju red u `rsvp_responses`, što bi u SQL-u tražilo poseban `OR IS
  // NULL` uslov na svakoj varijanti.
  if (filters.odgovor === 'svi') return mapped;
  if (filters.odgovor === 'pending') {
    return mapped.filter((guest) => guest.rsvpStatus === null || guest.rsvpStatus === 'pending');
  }
  return mapped.filter((guest) => guest.rsvpStatus === filters.odgovor);
}

export async function countGuests(eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(guests)
    .where(and(eq(guests.eventId, eventId), isNull(guests.deletedAt)));

  return row?.value ?? 0;
}

/** Sve oznake koje su u upotrebi - punjenje filtera bez posebne tabele. */
export async function listGuestTags(eventId: string): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(sql`
    select distinct jsonb_array_elements_text(${guests.tags}) as tag
    from ${guests}
    where ${guests.eventId} = ${eventId} and ${guests.deletedAt} is null
    order by tag
  `);

  return rows.map((row) => row.tag);
}

export async function listHouseholds(eventId: string): Promise<HouseholdRow[]> {
  const rows = await db
    .select({
      id: guestHouseholds.id,
      name: guestHouseholds.name,
      maxGuests: guestHouseholds.maxGuests,
      notes: guestHouseholds.notes,
      /*
       * Imena tabela i kolona su ovde ispisana, a ne uzeta iz šeme.
       *
       * Drizzle unutar `select` polja renderuje kolonu **bez kvalifikatora**
       * (`"id"` umesto `"guest_households"."id"`), pa bi u korelisanom podupitu
       * `guest_households.id` bilo protumačeno kao `guests.id` - poređenje koje
       * je uvek netačno, a ne baca grešku. Zato podupiti nose eksplicitne
       * aliase i puna imena.
       */
      guestCount: sql<number>`(
        select count(*)::int from guests g
        where g.household_id = guest_households.id and g.deleted_at is null
      )`,
      recipientId: sql<string | null>`(
        select r.id from invitation_recipients r
        where r.household_id = guest_households.id and r.revoked_at is null
        limit 1
      )`,
    })
    .from(guestHouseholds)
    .where(eq(guestHouseholds.eventId, eventId))
    .orderBy(asc(guestHouseholds.name));

  return rows;
}

// --- Izmene -----------------------------------------------------------------

async function assertGuestLimit(
  userId: string,
  eventId: string,
  adding: number,
): Promise<void> {
  const entitlements = await getUserEntitlements(userId);
  const used = await countGuests(eventId);
  const limit = checkLimit(entitlements, 'maxGuests', used, adding);

  if (!limit.allowed) {
    throw new LimitExceededError(
      `Vaš paket dozvoljava najviše ${limit.limit} gostiju.`,
      { limit: limit.limit, current: limit.current, feature: 'maxGuests' },
    );
  }
}

/** Prazan string u formi znači „nije uneto", a u bazi to je `NULL`. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function createGuest(
  eventId: string,
  userId: string,
  input: GuestInput,
): Promise<{ guestId: string }> {
  await assertGuestLimit(userId, eventId, 1);
  await assertHouseholdBelongsToEvent(eventId, input.householdId);

  const [guest] = await db
    .insert(guests)
    .values({
      eventId,
      householdId: emptyToNull(input.householdId),
      firstName: input.firstName,
      lastName: emptyToNull(input.lastName),
      email: emptyToNull(input.email),
      phone: emptyToNull(input.phone),
      isChild: input.isChild,
      tags: normalizeTags(input.tags),
      privateNote: emptyToNull(input.privateNote),
    })
    .returning({ id: guests.id });

  if (!guest) throw new Error('Gost nije napravljen.');
  return { guestId: guest.id };
}

export async function updateGuest(
  eventId: string,
  guestId: string,
  input: GuestInput,
): Promise<void> {
  await assertHouseholdBelongsToEvent(eventId, input.householdId);

  const updated = await db
    .update(guests)
    .set({
      householdId: emptyToNull(input.householdId),
      firstName: input.firstName,
      lastName: emptyToNull(input.lastName),
      email: emptyToNull(input.email),
      phone: emptyToNull(input.phone),
      isChild: input.isChild,
      tags: normalizeTags(input.tags),
      privateNote: emptyToNull(input.privateNote),
    })
    // `eventId` u uslovu je zaštita od IDOR-a, ne optimizacija.
    .where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)))
    .returning({ id: guests.id });

  if (updated.length === 0) throw new NotFoundError('Gost ne postoji.');
}

/**
 * Meko brisanje gosta.
 *
 * Odgovor koji je gost već poslao ostaje - organizator ga i dalje broji u
 * statistici, a i sam gost bi se s pravom začudio da mu potvrda nestane.
 */
export async function deleteGuest(eventId: string, guestId: string): Promise<void> {
  const updated = await db
    .update(guests)
    .set({ deletedAt: new Date() })
    .where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)))
    .returning({ id: guests.id });

  if (updated.length === 0) throw new NotFoundError('Gost ne postoji.');

  // Personalizovani link obrisanog gosta prestaje da radi odmah.
  await db
    .update(invitationRecipients)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitationRecipients.guestId, guestId),
        isNull(invitationRecipients.revokedAt),
      ),
    );
}

async function assertHouseholdBelongsToEvent(
  eventId: string,
  householdId: string,
): Promise<void> {
  if (!householdId) return;

  const [household] = await db
    .select({ id: guestHouseholds.id })
    .from(guestHouseholds)
    .where(
      and(eq(guestHouseholds.id, householdId), eq(guestHouseholds.eventId, eventId)),
    )
    .limit(1);

  if (!household) throw new NotFoundError('Domaćinstvo ne postoji.');
}

/** Oznake bez duplikata i praznih vrednosti, sa stabilnim redosledom. */
function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'sr-Latn'));
}

// --- Domaćinstva ------------------------------------------------------------

export async function createHousehold(
  eventId: string,
  input: { name: string; maxGuests: number | ''; notes: string },
): Promise<{ householdId: string }> {
  const [household] = await db
    .insert(guestHouseholds)
    .values({
      eventId,
      name: input.name,
      maxGuests: input.maxGuests === '' ? null : input.maxGuests,
      notes: emptyToNull(input.notes),
    })
    .returning({ id: guestHouseholds.id });

  if (!household) throw new Error('Domaćinstvo nije napravljeno.');
  return { householdId: household.id };
}

export async function updateHousehold(
  eventId: string,
  householdId: string,
  input: { name: string; maxGuests: number | ''; notes: string },
): Promise<void> {
  const updated = await db
    .update(guestHouseholds)
    .set({
      name: input.name,
      maxGuests: input.maxGuests === '' ? null : input.maxGuests,
      notes: emptyToNull(input.notes),
    })
    .where(
      and(eq(guestHouseholds.id, householdId), eq(guestHouseholds.eventId, eventId)),
    )
    .returning({ id: guestHouseholds.id });

  if (updated.length === 0) throw new NotFoundError('Domaćinstvo ne postoji.');
}

/**
 * Brisanje domaćinstva.
 *
 * Gosti ostaju - samo prestaju da budu grupisani (`ON DELETE SET NULL`).
 * Brisanje domaćinstva ne sme da obriše ljude iz spiska.
 */
export async function deleteHousehold(
  eventId: string,
  householdId: string,
): Promise<void> {
  const deleted = await db
    .delete(guestHouseholds)
    .where(
      and(eq(guestHouseholds.id, householdId), eq(guestHouseholds.eventId, eventId)),
    )
    .returning({ id: guestHouseholds.id });

  if (deleted.length === 0) throw new NotFoundError('Domaćinstvo ne postoji.');
}

// --- Personalizovani linkovi ------------------------------------------------

export type IssuedLink = {
  recipientId: string;
  /** Token u čitljivom obliku - vraća se **samo jednom**, pri izdavanju. */
  token: string;
  /** Slug pozivnice, da pozivalac može da sastavi ceo link. */
  slug: string;
};

/**
 * Izdavanje personalizovanog linka (zahtev 13 i 39.6).
 *
 * Token je kriptografski nepredvidiv i u bazi živi samo kao heš. Zbog toga se
 * jednom izdat link ne može ponovo pročitati - može se samo izdati novi, čime
 * stari prestaje da važi. To je namerno: baza koja procuri ne sme da otvori
 * tuđe pozivnice.
 */
export async function issueRecipientLink(input: {
  eventId: string;
  guestId?: string | null;
  householdId?: string | null;
}): Promise<IssuedLink> {
  if (!input.guestId && !input.householdId) {
    throw new ValidationError('Izaberite gosta ili domaćinstvo.');
  }

  const [invitation] = await db
    .select({ id: invitations.id, slug: invitations.publicSlug })
    .from(invitations)
    .where(eq(invitations.eventId, input.eventId))
    .limit(1);

  if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

  const greeting = input.guestId
    ? await guestGreeting(input.eventId, input.guestId)
    : await householdGreeting(input.eventId, input.householdId ?? '');

  // Novi link poništava prethodni za istog primaoca - inače bi u opticaju
  // ostala dva linka za istu osobu, a odgovor sme da postoji samo jedan.
  await revokeExistingLinks(input.guestId ?? null, input.householdId ?? null);

  const token = randomToken(RECIPIENT_TOKEN_LENGTH);

  const [recipient] = await db
    .insert(invitationRecipients)
    .values({
      invitationId: invitation.id,
      guestId: input.guestId || null,
      householdId: input.householdId || null,
      tokenHash: hashToken(token),
      greetingName: greeting.name,
      maxGuests: greeting.maxGuests,
    })
    .returning({ id: invitationRecipients.id });

  if (!recipient) throw new Error('Link nije napravljen.');
  return { recipientId: recipient.id, token, slug: invitation.slug };
}

async function revokeExistingLinks(
  guestId: string | null,
  householdId: string | null,
): Promise<void> {
  const target = guestId
    ? eq(invitationRecipients.guestId, guestId)
    : householdId
      ? eq(invitationRecipients.householdId, householdId)
      : null;

  if (!target) return;

  await db
    .update(invitationRecipients)
    .set({ revokedAt: new Date() })
    .where(and(target, isNull(invitationRecipients.revokedAt)));
}

async function guestGreeting(
  eventId: string,
  guestId: string,
): Promise<{ name: string; maxGuests: number | null }> {
  const [guest] = await db
    .select({ firstName: guests.firstName, lastName: guests.lastName })
    .from(guests)
    .where(and(eq(guests.id, guestId), eq(guests.eventId, eventId), isNull(guests.deletedAt)))
    .limit(1);

  if (!guest) throw new NotFoundError('Gost ne postoji.');

  return {
    name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
    maxGuests: null,
  };
}

async function householdGreeting(
  eventId: string,
  householdId: string,
): Promise<{ name: string; maxGuests: number | null }> {
  const [household] = await db
    .select({ name: guestHouseholds.name, maxGuests: guestHouseholds.maxGuests })
    .from(guestHouseholds)
    .where(
      and(eq(guestHouseholds.id, householdId), eq(guestHouseholds.eventId, eventId)),
    )
    .limit(1);

  if (!household) throw new NotFoundError('Domaćinstvo ne postoji.');
  return { name: household.name, maxGuests: household.maxGuests };
}

export async function revokeRecipientLink(
  eventId: string,
  recipientId: string,
): Promise<void> {
  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.eventId, eventId))
    .limit(1);

  if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

  const updated = await db
    .update(invitationRecipients)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitationRecipients.id, recipientId),
        eq(invitationRecipients.invitationId, invitation.id),
      ),
    )
    .returning({ id: invitationRecipients.id });

  if (updated.length === 0) throw new NotFoundError('Link ne postoji.');
}

// --- Uvoz -------------------------------------------------------------------

export type ImportSummary = {
  created: number;
  skipped: number;
  /** Redovi koje nismo mogli da pročitamo, sa razlogom. */
  problems: Array<{ row: number; message: string }>;
};

const COLUMN_ALIASES = {
  firstName: ['ime', 'firstname', 'first name', 'name', 'gost'],
  lastName: ['prezime', 'lastname', 'last name', 'surname'],
  email: ['email', 'e-mail', 'mejl', 'imejl', 'mail'],
  phone: ['telefon', 'phone', 'mobilni', 'broj'],
  household: ['domacinstvo', 'domaćinstvo', 'household', 'porodica', 'grupa'],
  tags: ['oznake', 'tags', 'tagovi', 'kategorija'],
  isChild: ['dete', 'child', 'deca'],
  note: ['beleska', 'beleška', 'napomena', 'note', 'notes'],
} as const;

/**
 * Uvoz gostiju iz CSV-a (zahtev 12).
 *
 * Fajl skoro nikad nije napravljen za nas - dolazi iz tuđe tabele, sa kolonama
 * na srpskom ili engleskom i u proizvoljnom redosledu. Zato se kolone
 * **prepoznaju** po nazivu, a red koji ne razumemo se preskoči sa objašnjenjem
 * umesto da obori ceo uvoz.
 */
export async function importGuests(input: {
  eventId: string;
  userId: string;
  csv: string;
  hasHeader: boolean;
}): Promise<ImportSummary> {
  const rows = parseCsv(input.csv);
  if (rows.length === 0) {
    throw new ValidationError('Fajl je prazan.');
  }

  const header = input.hasHeader ? (rows[0] ?? []) : [];
  const dataRows = input.hasHeader ? rows.slice(1) : rows;

  const columns = input.hasHeader ? mapColumns(header) : DEFAULT_COLUMN_ORDER;

  if (columns.firstName < 0) {
    throw new ValidationError(
      'Nije pronađena kolona sa imenom. Prva kolona treba da bude „Ime”.',
    );
  }

  /*
   * Granica paketa se proverava nad brojem redova koji zaista postaju gosti, a
   * ne nad brojem redova u fajlu: prazni i neispravni redovi se ionako
   * preskaču, pa bi njihovo brojanje odbilo uvoz koji u paket staje.
   */
  const usableRows = dataRows.filter(
    (row) => (row[columns.firstName] ?? '').trim() !== '',
  ).length;
  await assertGuestLimit(input.userId, input.eventId, usableRows);

  const households = new Map(
    (await listHouseholds(input.eventId)).map((household) => [
      household.name.toLowerCase(),
      household.id,
    ]),
  );

  const summary: ImportSummary = { created: 0, skipped: 0, problems: [] };
  const pending: Array<typeof guests.$inferInsert> = [];

  for (const [index, row] of dataRows.entries()) {
    const lineNumber = index + (input.hasHeader ? 2 : 1);
    const firstName = (row[columns.firstName] ?? '').trim();

    if (!firstName) {
      summary.skipped += 1;
      summary.problems.push({ row: lineNumber, message: 'Nedostaje ime.' });
      continue;
    }

    const householdName = pick(row, columns.household);
    let householdId: string | null = null;

    if (householdName) {
      const key = householdName.toLowerCase();
      const existing = households.get(key);

      if (existing) {
        householdId = existing;
      } else {
        // Domaćinstvo iz fajla se pravi u hodu: organizator ne treba prvo da
        // ručno unese sve porodice pa tek onda uveze goste.
        const created = await createHousehold(input.eventId, {
          name: householdName,
          maxGuests: '',
          notes: '',
        });
        households.set(key, created.householdId);
        householdId = created.householdId;
      }
    }

    pending.push({
      eventId: input.eventId,
      householdId,
      firstName: firstName.slice(0, 80),
      lastName: pick(row, columns.lastName)?.slice(0, 80) ?? null,
      email: pick(row, columns.email)?.slice(0, 160) ?? null,
      phone: pick(row, columns.phone)?.slice(0, 32) ?? null,
      isChild: parseBoolean(pick(row, columns.isChild)),
      tags: parseTags(pick(row, columns.tags)),
      privateNote: pick(row, columns.note)?.slice(0, 500) ?? null,
    });
  }

  if (pending.length > 0) {
    await db.insert(guests).values(pending);
    summary.created = pending.length;
  }

  return summary;
}

type ColumnMap = Record<keyof typeof COLUMN_ALIASES, number>;

/** Kada fajl nema zaglavlje, pretpostavljamo najčešći redosled kolona. */
const DEFAULT_COLUMN_ORDER: ColumnMap = {
  firstName: 0,
  lastName: 1,
  email: 2,
  phone: 3,
  household: 4,
  tags: 5,
  isChild: -1,
  note: -1,
};

function mapColumns(header: readonly string[]): ColumnMap {
  const result = { ...DEFAULT_COLUMN_ORDER };

  for (const key of Object.keys(COLUMN_ALIASES) as Array<keyof typeof COLUMN_ALIASES>) {
    result[key] = header.findIndex((value) => matchColumn(value, COLUMN_ALIASES[key]));
  }

  return result;
}

function pick(row: readonly string[], index: number): string | null {
  if (index < 0) return null;
  const value = (row[index] ?? '').trim();
  return value === '' ? null : value;
}

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  return ['da', 'yes', 'true', '1', 'x'].includes(value.trim().toLowerCase());
}

function parseTags(value: string | null): string[] {
  if (!value) return [];
  return normalizeTags(value.split(/[,;|]/));
}

// --- Izvoz ------------------------------------------------------------------

export async function loadGuestsForExport(eventId: string): Promise<GuestRow[]> {
  return listGuests(eventId, { odgovor: 'svi', redosled: 'prezime' });
}

/** Gosti bez odgovora - osnova za podsetnike (zahtev 5.10). */
export async function listGuestsWithoutResponse(eventId: string): Promise<GuestRow[]> {
  return listGuests(eventId, { odgovor: 'pending', redosled: 'prezime' });
}

/** Domaćinstva bez ijednog gosta - česta posledica uvoza. */
export async function listEmptyHouseholdIds(eventId: string): Promise<string[]> {
  const rows = await db
    .select({ id: guestHouseholds.id })
    .from(guestHouseholds)
    .leftJoin(
      guests,
      and(eq(guests.householdId, guestHouseholds.id), isNull(guests.deletedAt)),
    )
    .where(eq(guestHouseholds.eventId, eventId))
    .groupBy(guestHouseholds.id)
    .having(sql`count(${guests.id}) = 0`);

  return rows.map((row) => row.id);
}

/** Gosti po identifikatorima, uvek u okviru istog događaja. */
export async function loadGuestsByIds(
  eventId: string,
  ids: readonly string[],
): Promise<GuestRow[]> {
  if (ids.length === 0) return [];
  const all = await listGuests(eventId, { odgovor: 'svi', redosled: 'prezime' });
  const wanted = new Set(ids);
  return all.filter((guest) => wanted.has(guest.id));
}

export async function getGuestById(
  eventId: string,
  guestId: string,
): Promise<GuestRow | null> {
  const rows = await loadGuestsByIds(eventId, [guestId]);
  return rows[0] ?? null;
}

/** Broj gostiju po domaćinstvima - koristi ga izvoz i grupno slanje. */
export async function countGuestsByHousehold(
  eventId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ householdId: guests.householdId, value: count() })
    .from(guests)
    .where(
      and(
        eq(guests.eventId, eventId),
        isNull(guests.deletedAt),
        inArray(
          guests.householdId,
          db
            .select({ id: guestHouseholds.id })
            .from(guestHouseholds)
            .where(eq(guestHouseholds.eventId, eventId)),
        ),
      ),
    )
    .groupBy(guests.householdId);

  return new Map(
    rows.flatMap((row) => (row.householdId ? [[row.householdId, row.value]] : [])),
  );
}
