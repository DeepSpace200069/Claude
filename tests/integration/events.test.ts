import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { defaultThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import { events, invitationSections, invitations, users } from '@/server/db/schema';
import { LimitExceededError } from '@/server/authz/errors';
import { createEvent, getEventDetail, listEventsForUser, softDeleteEvent } from '@/server/services/events';
import { changeInvitationSlug } from '@/server/services/slug';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Integracioni testovi rade nad pravom bazom.
 *
 * Cilj je da provere ono što unit testovi ne mogu: transakcije, jedinstvenost
 * sluga i to da izmena sadržaja ne menja javni link (zahtev 38).
 */
describe.skipIf(!hasTestDatabase)('kreiranje događaja', () => {
  let weddingTypeId: string;

  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
  });

  const baseInput = () => ({
    eventTypeId: weddingTypeId,
    name: 'Milica i Stefan',
    details: { partner1Name: 'Milica', partner2Name: 'Stefan' },
    date: '2026-09-12',
    time: '13:00',
    timeZone: 'Europe/Belgrade',
    city: 'Beograd',
    venueName: 'Restoran Dunavski kej',
    primaryLocale: 'sr-Latn' as const,
  });

  it('pravi događaj i pozivnicu u jednoj transakciji', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    expect(result.eventId).toBeTruthy();
    expect(result.invitationId).toBeTruthy();
    expect(result.slug).toBe('milica-i-stefan');

    const detail = await getEventDetail(result.eventId);
    expect(detail?.name).toBe('Milica i Stefan');
    expect(detail?.city).toBe('Beograd');
    expect(detail?.invitationSlug).toBe('milica-i-stefan');
  });

  it('čuva datum kao trenutak u zoni događaja', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    const detail = await getEventDetail(result.eventId);
    expect(detail?.startsAt?.toISOString()).toBe('2026-09-12T11:00:00.000Z');
  });

  it('drugi događaj istog naziva dobija drugačiji slug', async () => {
    const user = await createTestUser();
    const first = await createEvent(user.id, baseInput());
    const second = await createEvent(user.id, baseInput());

    expect(second.slug).not.toBe(first.slug);
    expect(second.slug).toMatch(/^milica-i-stefan-\d+$/);
  });

  it('slugovi ostaju jedinstveni i između različitih korisnika', async () => {
    const first = await createTestUser();
    const second = await createTestUser();

    const a = await createEvent(first.id, baseInput());
    const b = await createEvent(second.id, baseInput());

    expect(a.slug).not.toBe(b.slug);
  });

  it('poštuje limit paketa za broj događaja', async () => {
    await raiseEventLimit(2);
    const user = await createTestUser();

    await createEvent(user.id, baseInput());
    await createEvent(user.id, baseInput());

    await expect(createEvent(user.id, baseInput())).rejects.toBeInstanceOf(
      LimitExceededError,
    );

    const list = await listEventsForUser(user.id);
    expect(list).toHaveLength(2);
  });

  it('lista prikazuje samo sopstvene događaje', async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();

    await createEvent(owner.id, baseInput());

    expect(await listEventsForUser(owner.id)).toHaveLength(1);
    expect(await listEventsForUser(stranger.id)).toHaveLength(0);
  });

  it('obrisan događaj nestaje iz liste, ali ostaje u bazi', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    await softDeleteEvent(result.eventId);

    expect(await listEventsForUser(user.id)).toHaveLength(0);
    expect(await getEventDetail(result.eventId)).toBeNull();

    const [row] = await db
      .select({ deletedAt: events.deletedAt, status: events.status })
      .from(events)
      .where(eq(events.id, result.eventId));

    expect(row?.deletedAt).not.toBeNull();
    expect(row?.status).toBe('archived');
  });

  it('brisanje događaja povlači pozivnicu iz objave', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    await db
      .update(invitations)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(invitations.id, result.invitationId));

    await softDeleteEvent(result.eventId);

    const [invitation] = await db
      .select({ status: invitations.status })
      .from(invitations)
      .where(eq(invitations.id, result.invitationId));

    expect(invitation?.status).toBe('unpublished');
  });
});

describe.skipIf(!hasTestDatabase)('stabilnost javnog linka', () => {
  let weddingTypeId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
  });

  it('izmena sadržaja ne menja javni link (zahtev 38)', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Ana i Marko',
      details: {},
      date: '2026-06-06',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Stari restoran',
      primaryLocale: 'sr-Latn',
    });

    const slugBefore = created.slug;

    // Menjamo lokaciju, vreme i naziv - sve što korisnik realno menja.
    await db
      .update(events)
      .set({
        name: 'Ana i Marko - venčanje',
        venueName: 'Novi restoran',
        city: 'Beograd',
      })
      .where(eq(events.id, created.eventId));

    const detail = await getEventDetail(created.eventId);

    expect(detail?.venueName).toBe('Novi restoran');
    expect(detail?.invitationSlug).toBe(slugBefore);
  });

  it('slug se menja samo kroz kontrolisanu operaciju', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Jovana i Nikola',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    const changed = await changeInvitationSlug(created.invitationId, 'nas-veliki-dan');
    expect(changed.ok).toBe(true);

    const detail = await getEventDetail(created.eventId);
    expect(detail?.invitationSlug).toBe('nas-veliki-dan');
  });

  it('odbija rezervisan slug', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Test događaj',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    const result = await changeInvitationSlug(created.invitationId, 'admin');
    expect(result).toEqual({ ok: false, reason: 'reserved' });
  });

  it('odbija slug koji je već zauzet', async () => {
    const user = await createTestUser();
    const first = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Prvi događaj',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });
    const second = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Drugi događaj',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    const result = await changeInvitationSlug(second.invitationId, first.slug);
    expect(result).toEqual({ ok: false, reason: 'taken' });
  });

  it('odbija slug neispravnog oblika', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name: 'Test oblika',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    expect(await changeInvitationSlug(created.invitationId, 'Veliko Slovo')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await changeInvitationSlug(created.invitationId, 'ab')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});

/**
 * Provere koje se ne mogu uraditi bez baze: CHECK ograničenja, jedinstvenost i
 * cascade pravila iz migracija.
 */
describe.skipIf(!hasTestDatabase)('integritet baze', () => {
  let weddingTypeId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
  });

  const insertBareEvent = async (ownerId: string) => {
    const [event] = await db
      .insert(events)
      .values({ ownerId, eventTypeId: weddingTypeId, name: 'Test' })
      .returning({ id: events.id });

    if (!event) throw new Error('Događaj nije napravljen.');
    return event.id;
  };

  it('baza odbija slug koji ne poštuje format', async () => {
    const user = await createTestUser();
    const eventId = await insertBareEvent(user.id);

    // CHECK ograničenje iz migracije 0001 mora da odbije slug sa velikim slovom.
    await expect(
      db.insert(invitations).values({
        eventId,
        publicSlug: 'NEISPRAVAN_SLUG',
        themeTokens: defaultThemeTokens,
      }),
    ).rejects.toThrow();
  });

  it('baza odbija prekratak slug', async () => {
    const user = await createTestUser();
    const eventId = await insertBareEvent(user.id);

    await expect(
      db.insert(invitations).values({
        eventId,
        publicSlug: 'ab',
        themeTokens: defaultThemeTokens,
      }),
    ).rejects.toThrow();
  });

  it('jedan događaj može imati najviše jednu pozivnicu', async () => {
    const user = await createTestUser();
    const eventId = await insertBareEvent(user.id);

    await db.insert(invitations).values({
      eventId,
      publicSlug: 'prva-pozivnica',
      themeTokens: defaultThemeTokens,
    });

    await expect(
      db.insert(invitations).values({
        eventId,
        publicSlug: 'druga-pozivnica',
        themeTokens: defaultThemeTokens,
      }),
    ).rejects.toThrow();
  });

  it('brisanje korisnika briše i njegove događaje (cascade)', async () => {
    const user = await createTestUser();
    await insertBareEvent(user.id);

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.ownerId, user.id));

    expect(remaining).toHaveLength(0);
  });

  it('brisanje pozivnice briše njene sekcije (cascade)', async () => {
    const user = await createTestUser();
    const eventId = await insertBareEvent(user.id);

    const [invitation] = await db
      .insert(invitations)
      .values({ eventId, publicSlug: 'sa-sekcijama', themeTokens: defaultThemeTokens })
      .returning({ id: invitations.id });

    if (!invitation) throw new Error('Pozivnica nije napravljena.');

    await db.insert(invitationSections).values({
      invitationId: invitation.id,
      type: 'hero',
      schemaVersion: 1,
      position: 0,
      data: {},
    });

    await db.delete(invitations).where(eq(invitations.id, invitation.id));

    const sections = await db
      .select({ id: invitationSections.id })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, invitation.id));

    expect(sections).toHaveLength(0);
  });
});
