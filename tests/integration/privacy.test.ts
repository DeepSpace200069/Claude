import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import {
  eventCollaborators,
  events,
  featurePlans,
  guests,
  invitations,
  orders,
  sessions,
  users,
  webhookEvents,
} from '@/server/db/schema';
import {
  deleteAccount,
  deletionPreview,
  exportUserData,
  pruneExpiredData,
} from '@/server/services/privacy';
import { createEvent } from '@/server/services/events';
import { createGuest } from '@/server/services/guests';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  raiseGuestLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Privatnost (zahtev 25).
 *
 * Tri obećanja koja moraju da budu tačna u bazi, a ne samo u pravnom tekstu:
 * izvoz sadrži sve, brisanje briše lični sadržaj i onemogućava prijavu, a
 * retencija zaista uklanja ono čemu je istekao rok.
 */
describe.skipIf(!hasTestDatabase)('privatnost', () => {
  let weddingTypeId: string;
  let owner: { id: string; email: string };
  let eventId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    owner = await createTestUser({ email: 'vlasnik@primer.rs' });
    const event = await createEvent(owner.id, {
      eventTypeId: weddingTypeId,
      name: 'Milica i Stefan',
      details: {},
      date: '2026-09-12',
      time: '13:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Sala',
      primaryLocale: 'sr-Latn',
    });
    eventId = event.eventId;

    await createGuest(eventId, {
      firstName: 'Ana',
      lastName: 'Anić',
      email: 'ana@primer.rs',
      phone: '',
      tags: ['porodica'],
      privateNote: 'Vegetarijanka',
      householdId: '',
      isChild: false,
    });
  });

  describe('preuzimanje podataka', () => {
    it('vraća profil, događaje, pozivnice i goste', async () => {
      const data = await exportUserData(owner.id);

      expect(data.format).toBe('pozivnica-export');
      expect(data.profile).toMatchObject({ email: owner.email });
      expect(data.events).toHaveLength(1);
      expect(data.invitations).toHaveLength(1);
      expect(data.guests).toHaveLength(1);
      expect(data.guests[0]).toMatchObject({ firstName: 'Ana' });
    });

    it('ne izvozi tajne', async () => {
      const raw = JSON.stringify(await exportUserData(owner.id));

      // Heševi PIN-a i tokena su tajne, a ne podaci - u izvozu im nije mesto.
      expect(raw).not.toContain('pinHash');
      expect(raw).not.toContain('tokenHash');
      expect(raw).not.toContain('inviteTokenHash');
    });

    it('ne izvozi tuđe podatke', async () => {
      const drugi = await createTestUser({ email: 'drugi@primer.rs' });
      await createEvent(drugi.id, {
        eventTypeId: weddingTypeId,
        name: 'Tuđe venčanje',
        details: {},
        date: '2026-10-10',
        time: '12:00',
        timeZone: 'Europe/Belgrade',
        city: 'Niš',
        venueName: 'Sala',
        primaryLocale: 'sr-Latn',
      });

      const data = await exportUserData(owner.id);
      expect(data.events).toHaveLength(1);
      expect(JSON.stringify(data)).not.toContain('Tuđe venčanje');
    });

    it('korisnik bez događaja dobija prazan, ali ispravan izvoz', async () => {
      const prazan = await createTestUser({ email: 'prazan@primer.rs' });
      const data = await exportUserData(prazan.id);

      expect(data.events).toEqual([]);
      expect(data.guests).toEqual([]);
      expect(data.profile).toMatchObject({ email: 'prazan@primer.rs' });
    });
  });

  describe('brisanje naloga', () => {
    async function payFor(userId: string, forEventId: string): Promise<void> {
      const [plan] = await db
        .select({ id: featurePlans.id })
        .from(featurePlans)
        .where(eq(featurePlans.code, 'premium'))
        .limit(1);

      if (!plan) throw new Error('Paket nije zasejan.');

      await db.insert(orders).values({
        userId,
        eventId: forEventId,
        planId: plan.id,
        status: 'paid',
        subtotalMinor: 290000,
        totalMinor: 290000,
        currency: 'RSD',
        idempotencyKey: `test-${forEventId}`,
      });
    }

    it('briše događaje, pozivnice i goste', async () => {
      await deleteAccount(owner.id);

      expect(
        await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)),
      ).toHaveLength(0);
      expect(await db.select({ id: guests.id }).from(guests)).toHaveLength(0);
      expect(await db.select({ id: invitations.id }).from(invitations)).toHaveLength(0);
    });

    it('anonimizuje nalog i onemogućava prijavu', async () => {
      await db.insert(sessions).values({
        sessionToken: 'test-sesija',
        userId: owner.id,
        expires: new Date(Date.now() + 86_400_000),
      });

      await deleteAccount(owner.id);

      const [user] = await db
        .select({
          email: users.email,
          name: users.name,
          deletedAt: users.deletedAt,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, owner.id));

      expect(user?.email).not.toBe('vlasnik@primer.rs');
      expect(user?.email).toContain('obrisano.invalid');
      expect(user?.name).toBeNull();
      expect(user?.deletedAt).toBeInstanceOf(Date);
      expect(user?.emailVerified).toBeNull();

      // Bez sesije nema prijavljenog stanja ni na jednom uređaju.
      expect(await db.select({ token: sessions.sessionToken }).from(sessions)).toHaveLength(0);
    });

    it('zadržava narudžbinu, ali bez veze sa osobom', async () => {
      await payFor(owner.id, eventId);

      const result = await deleteAccount(owner.id);
      expect(result.keptOrders).toBe(1);

      const [order] = await db
        .select({ id: orders.id, eventId: orders.eventId, userId: orders.userId })
        .from(orders);

      expect(order).toBeTruthy();
      // Događaj je obrisan, pa veza pada na `null` (on delete set null).
      expect(order?.eventId).toBeNull();

      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, order?.userId ?? ''));

      expect(user?.email).toContain('obrisano.invalid');
    });

    it('pregled pre brisanja kaže tačne brojeve', async () => {
      await payFor(owner.id, eventId);
      const preview = await deletionPreview(owner.id);

      expect(preview.events).toBe(1);
      expect(preview.guests).toBe(1);
      expect(preview.orders).toBe(1);
    });

    it('zapis o brisanju ne čuva email', async () => {
      await deleteAccount(owner.id);

      const [entry] = await db.execute<{ action: string; actor_email: string | null }>(
        sql`select action, actor_email from audit_logs where action = 'user.account_deleted'`,
      );

      expect(entry?.action).toBe('user.account_deleted');
      expect(entry?.actor_email).toBeNull();
    });
  });

  describe('retencija', () => {
    it('meko obrisan događaj nestaje posle roka', async () => {
      // Događaj obrisan pre dve godine - rok je istekao davno.
      await db
        .update(events)
        .set({ deletedAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) })
        .where(eq(events.id, eventId));

      const report = await pruneExpiredData();

      expect(report.events).toBe(1);
      expect(
        await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)),
      ).toHaveLength(0);
    });

    it('skoro obrisan događaj se ne dira - korisnik može da se predomisli', async () => {
      await db
        .update(events)
        .set({ deletedAt: new Date() })
        .where(eq(events.id, eventId));

      const report = await pruneExpiredData();

      expect(report.events).toBe(0);
      expect(
        await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)),
      ).toHaveLength(1);
    });

    it('briše istekle sesije i stare webhookove', async () => {
      await db.insert(sessions).values({
        sessionToken: 'istekla',
        userId: owner.id,
        expires: new Date(Date.now() - 1000),
      });

      await db.insert(webhookEvents).values({
        provider: 'dev',
        externalId: 'stari',
        type: 'payment.succeeded',
        payload: {},
        createdAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000),
      });

      const report = await pruneExpiredData();

      expect(report.sessions).toBe(1);
      expect(report.webhookEvents).toBe(1);
    });

    it('istekao poziv saradniku gubi token, ali ostaje vidljiv vlasniku', async () => {
      await db.insert(eventCollaborators).values({
        eventId,
        email: 'pomocnik@primer.rs',
        role: 'editor',
        status: 'pending',
        inviteTokenHash: 'a'.repeat(64),
        inviteExpiresAt: new Date(Date.now() - 1000),
      });

      const report = await pruneExpiredData();
      expect(report.invites).toBe(1);

      const [row] = await db
        .select({
          status: eventCollaborators.status,
          tokenHash: eventCollaborators.inviteTokenHash,
        })
        .from(eventCollaborators);

      expect(row?.status).toBe('pending');
      expect(row?.tokenHash).toBeNull();
    });
  });
});
