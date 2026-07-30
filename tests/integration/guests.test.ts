import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { hashToken } from '@/lib/ids';
import { db } from '@/server/db';
import { featurePlans, guests, invitationRecipients } from '@/server/db/schema';
import { LimitExceededError, NotFoundError } from '@/server/authz/errors';
import { createEvent } from '@/server/services/events';
import {
  countGuests,
  createGuest,
  createHousehold,
  deleteGuest,
  deleteHousehold,
  importGuests,
  issueRecipientLink,
  listGuestTags,
  listGuests,
  listHouseholds,
  revokeRecipientLink,
  updateGuest,
} from '@/server/services/guests';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  raiseGuestLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Spisak gostiju od kraja do kraja.
 *
 * Naglasak je na dve stvari koje se ne vide u tipovima: da nijedan upit ne
 * može da dohvati tuđeg gosta (zahtev 24 i 39.8) i da personalizovani token
 * postoji samo kao heš (zahtev 39.6).
 */
const suite = hasTestDatabase ? describe : describe.skip;

const ALL_FILTERS = { odgovor: 'svi', redosled: 'prezime' } as const;

suite('gosti i domaćinstva', () => {
  let userId: string;
  let otherUserId: string;
  let eventId: string;
  let otherEventId: string;

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    const owner = await createTestUser();
    const stranger = await createTestUser();
    userId = owner.id;
    otherUserId = stranger.id;

    const mine = await createEvent(userId, {
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
    eventId = mine.eventId;

    const theirs = await createEvent(otherUserId, {
      eventTypeId: weddingTypeId,
      name: 'Tuđe venčanje',
      details: {},
      date: '2026-10-03',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Niš',
      venueName: 'Hotel Tami',
      primaryLocale: 'sr-Latn',
    });
    otherEventId = theirs.eventId;
  });

  const guestInput = (overrides: Partial<Parameters<typeof createGuest>[1]> = {}) => ({
    firstName: 'Marko',
    lastName: 'Ilić',
    email: '',
    phone: '',
    isChild: false,
    tags: [],
    privateNote: '',
    householdId: '',
    ...overrides,
  });

  it('pravi gosta sa samo imenom', async () => {
    await createGuest(eventId, guestInput({ lastName: '', email: '', phone: '' }));

    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list).toHaveLength(1);
    expect(list[0]?.firstName).toBe('Marko');
    // Prazna polja u formi su `NULL` u bazi, ne prazan string.
    expect(list[0]?.lastName).toBeNull();
    expect(list[0]?.email).toBeNull();
  });

  it('čisti oznake od duplikata i praznih vrednosti', async () => {
    await createGuest(eventId, guestInput({ tags: ['kolege', ' kolege ', '', 'porodica'] }),
    );

    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list[0]?.tags).toEqual(['kolege', 'porodica']);
    expect(await listGuestTags(eventId)).toEqual(['kolege', 'porodica']);
  });

  it('ne dozvoljava izmenu tuđeg gosta', async () => {
    const { guestId } = await createGuest(otherEventId, guestInput());

    // Isti identifikator, pogrešan događaj - upit mora da ne nađe ništa.
    await expect(updateGuest(eventId, guestId, guestInput())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(deleteGuest(eventId, guestId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ne dozvoljava vezivanje gosta za tuđe domaćinstvo', async () => {
    const { householdId } = await createHousehold(otherEventId, {
      name: 'Porodica sa druge proslave',
      maxGuests: '',
      notes: '',
    });

    await expect(
      createGuest(eventId, guestInput({ householdId })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('meko brisanje čuva odgovor, ali gasi lični link', async () => {
    const { guestId } = await createGuest(eventId, guestInput());
    const issued = await issueRecipientLink({ eventId, guestId });

    await deleteGuest(eventId, guestId);

    expect(await countGuests(eventId)).toBe(0);
    expect(await listGuests(eventId, ALL_FILTERS)).toHaveLength(0);

    // Red gosta i dalje postoji - obrisan je samo iz spiska.
    const rows = await db.select().from(guests).where(eq(guests.id, guestId));
    expect(rows[0]?.deletedAt).not.toBeNull();

    const [recipient] = await db
      .select({ revokedAt: invitationRecipients.revokedAt })
      .from(invitationRecipients)
      .where(eq(invitationRecipients.id, issued.recipientId));
    expect(recipient?.revokedAt).not.toBeNull();
  });

  it('brisanje domaćinstva ostavlja goste na spisku', async () => {
    const { householdId } = await createHousehold(eventId, {
      name: 'Porodica Ilić',
      maxGuests: 4,
      notes: '',
    });
    await createGuest(eventId, guestInput({ householdId }));

    await deleteHousehold(eventId, householdId);

    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list).toHaveLength(1);
    expect(list[0]?.householdId).toBeNull();
  });

  it('broji goste po domaćinstvu', async () => {
    const { householdId } = await createHousehold(eventId, {
      name: 'Porodica Ilić',
      maxGuests: '',
      notes: '',
    });
    await createGuest(eventId, guestInput({ householdId }));
    await createGuest(eventId, guestInput({ firstName: 'Ana', householdId }));

    const households = await listHouseholds(eventId);
    expect(households[0]?.guestCount).toBe(2);
  });

  it('poštuje granicu paketa', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          limits: { ...DEFAULT_PLANS.free.limits, maxGuests: 2 },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    await createGuest(eventId, guestInput());
    await createGuest(eventId, guestInput({ firstName: 'Ana' }));

    await expect(
      createGuest(eventId, guestInput({ firstName: 'Petar' })),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });
});

suite('personalizovani linkovi', () => {
  let userId: string;
  let eventId: string;

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
  });

  it('token se u bazi čuva samo kao heš', async () => {
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

    const issued = await issueRecipientLink({ eventId, guestId });

    const [row] = await db
      .select({ tokenHash: invitationRecipients.tokenHash })
      .from(invitationRecipients)
      .where(eq(invitationRecipients.id, issued.recipientId));

    expect(row?.tokenHash).toBe(hashToken(issued.token));
    // Sam token ne sme da postoji nigde u redu.
    expect(row?.tokenHash).not.toBe(issued.token);
  });

  it('novi link poništava stari za istog gosta', async () => {
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

    const first = await issueRecipientLink({ eventId, guestId });
    const second = await issueRecipientLink({ eventId, guestId });

    expect(second.token).not.toBe(first.token);

    const [old] = await db
      .select({ revokedAt: invitationRecipients.revokedAt })
      .from(invitationRecipients)
      .where(eq(invitationRecipients.id, first.recipientId));

    expect(old?.revokedAt).not.toBeNull();

    // U spisku se vidi samo jedan aktivan link.
    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list[0]?.recipientId).toBe(second.recipientId);
  });

  it('poništen link se ne može poništiti dvaput bez greške za tuđi događaj', async () => {
    const { householdId } = await createHousehold(eventId, {
      name: 'Porodica Ilić',
      maxGuests: 3,
      notes: '',
    });
    const issued = await issueRecipientLink({ eventId, householdId });

    await revokeRecipientLink(eventId, issued.recipientId);

    await expect(
      revokeRecipientLink('11111111-2222-4333-8444-555555555555', issued.recipientId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

suite('uvoz gostiju iz CSV-a', () => {
  let userId: string;
  let eventId: string;

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
  });

  it('prepoznaje kolone u proizvoljnom redosledu i pravi domaćinstva u hodu', async () => {
    const csv = [
      'Domaćinstvo;Prezime;Ime;Telefon;Oznake',
      'Porodica Ilić;Ilić;Nenad;+381 21 123456;porodica',
      'Porodica Ilić;Ilić;Sanja;;porodica',
      'Kolege;Stanković;Marko;;kolege,posao',
    ].join('\n');

    const summary = await importGuests({ eventId, csv, hasHeader: true });

    expect(summary.created).toBe(3);
    expect(summary.skipped).toBe(0);

    const households = await listHouseholds(eventId);
    expect(households.map((household) => household.name).sort()).toEqual([
      'Kolege',
      'Porodica Ilić',
    ]);
    expect(households.find((h) => h.name === 'Porodica Ilić')?.guestCount).toBe(2);

    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list.find((guest) => guest.firstName === 'Marko')?.tags).toEqual([
      'kolege',
      'posao',
    ]);
  });

  it('prihvata engleska zaglavlja i zarez kao razdvajač', async () => {
    const csv = 'First name,Last name,Email\nAna,Popović,ana@primer.rs';

    const summary = await importGuests({ eventId, csv, hasHeader: true });

    expect(summary.created).toBe(1);
    const list = await listGuests(eventId, ALL_FILTERS);
    expect(list[0]?.email).toBe('ana@primer.rs');
  });

  it('preskače red bez imena uz objašnjenje, a ostale uvozi', async () => {
    const csv = ['Ime;Prezime', 'Marko;Ilić', ';Bez imena', 'Ana;Popović'].join('\n');

    const summary = await importGuests({ eventId, csv, hasHeader: true });

    expect(summary.created).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.problems).toEqual([{ row: 3, message: 'Nedostaje ime.' }]);
  });

  it('granica paketa se meri redovima koji zaista postaju gosti', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          limits: { ...DEFAULT_PLANS.free.limits, maxGuests: 2 },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    // Tri reda, ali jedan je prazan - u paket od dva gosta staje.
    const csv = ['Ime;Prezime', 'Marko;Ilić', ';', 'Ana;Popović'].join('\n');

    const summary = await importGuests({ eventId, csv, hasHeader: true });
    expect(summary.created).toBe(2);
  });

  it('odbija uvoz koji prelazi granicu paketa', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          limits: { ...DEFAULT_PLANS.free.limits, maxGuests: 1 },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    const csv = ['Ime;Prezime', 'Marko;Ilić', 'Ana;Popović'].join('\n');

    await expect(
      importGuests({ eventId, csv, hasHeader: true }),
    ).rejects.toBeInstanceOf(LimitExceededError);

    // Ništa nije upisano - uvoz je ili ceo prošao ili nije počeo.
    expect(await countGuests(eventId)).toBe(0);
  });
});
