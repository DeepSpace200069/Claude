import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import { events, rsvpResponses, users } from '@/server/db/schema';
import { setEmailAdapter, type EmailMessage } from '@/server/adapters/email';
import {
  notifyNewResponse,
  sendPendingDigests,
} from '@/server/services/notifications';
import { createEvent } from '@/server/services/events';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Email obaveštenja (zahtev 28).
 *
 * Najvažnija provera je „nikad znači nikad”: podešavanje koje se poštuje samo
 * ponekad gore je od podešavanja koje ne postoji.
 */
describe.skipIf(!hasTestDatabase)('obaveštenja o odgovorima', () => {
  const outbox: EmailMessage[] = [];

  const adapter = {
    name: 'test',
    async send(message: EmailMessage) {
      outbox.push(message);
      return { ok: true as const, id: `test-${outbox.length}` };
    },
  };

  let weddingTypeId: string;

  beforeEach(async () => {
    outbox.length = 0;
    setEmailAdapter(adapter);
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
  });

  afterAll(() => {
    setEmailAdapter(null);
  });

  async function eventFor(
    frequency: 'immediate' | 'daily' | 'weekly' | 'never',
  ): Promise<{ userId: string; eventId: string; invitationId: string }> {
    const user = await createTestUser();
    await db
      .update(users)
      .set({ rsvpNotifications: frequency })
      .where(eq(users.id, user.id));

    const event = await createEvent(user.id, {
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

    return {
      userId: user.id,
      eventId: event.eventId,
      invitationId: event.invitationId,
    };
  }

  /** Odgovor upisan direktno - test proverava obaveštenja, ne javnu formu. */
  async function addResponse(
    invitationId: string,
    overrides: Partial<{ status: 'yes' | 'no' | 'maybe'; adults: number; createdAt: Date }> = {},
  ): Promise<void> {
    await db.insert(rsvpResponses).values({
      invitationId,
      fullName: 'Ana Anić',
      status: overrides.status ?? 'yes',
      adultsCount: overrides.adults ?? 2,
      childrenCount: 0,
      createdAt: overrides.createdAt,
    });
  }

  describe('pojedinačno obaveštenje', () => {
    it('„odmah” šalje poruku sa imenom gosta i statusom', async () => {
      const { eventId } = await eventFor('immediate');

      const outcome = await notifyNewResponse({
        eventId,
        guestName: 'Ana Anić',
        status: 'yes',
        people: 2,
      });

      expect(outcome).toBe('sent');
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.subject).toContain('Milica i Stefan');
      expect(outbox[0]?.text).toContain('Ana Anić');
      expect(outbox[0]?.text).toContain('dolazi');
    });

    it('„nikad” ne šalje ništa', async () => {
      const { eventId } = await eventFor('never');

      const outcome = await notifyNewResponse({
        eventId,
        guestName: 'Ana',
        status: 'yes',
        people: 1,
      });

      expect(outcome).toBe('skipped');
      expect(outbox).toHaveLength(0);
    });

    it('„dnevno” odlaže poruku za rezime', async () => {
      const { eventId } = await eventFor('daily');

      const outcome = await notifyNewResponse({
        eventId,
        guestName: 'Ana',
        status: 'yes',
        people: 1,
      });

      expect(outcome).toBe('queued');
      expect(outbox).toHaveLength(0);
    });

    it('poruka ne nosi kontakt gosta', async () => {
      const { eventId } = await eventFor('immediate');

      await notifyNewResponse({
        eventId,
        guestName: 'Ana Anić',
        status: 'yes',
        people: 2,
      });

      // Kontakt putuje kroz tuđe servere bez potrebe - organizator ga vidi u aplikaciji.
      expect(outbox[0]?.text).not.toContain('@');
    });
  });

  describe('rezime', () => {
    it('šalje jednu poruku sa zbirom po događaju', async () => {
      const { invitationId } = await eventFor('daily');

      await addResponse(invitationId, { status: 'yes', adults: 2 });
      await addResponse(invitationId, { status: 'no' });
      await addResponse(invitationId, { status: 'maybe' });

      const report = await sendPendingDigests('daily');

      expect(report.sent).toBe(1);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.text).toContain('Milica i Stefan');
      expect(outbox[0]?.text).toContain('dolazi 1');
    });

    it('bez novih odgovora ne šalje prazan rezime', async () => {
      await eventFor('daily');

      const report = await sendPendingDigests('daily');

      expect(report.sent).toBe(0);
      expect(outbox).toHaveLength(0);
    });

    it('ne šalje dva puta u istom periodu', async () => {
      const { invitationId } = await eventFor('daily');
      await addResponse(invitationId);

      expect((await sendPendingDigests('daily')).sent).toBe(1);
      // Drugo pokretanje istog dana ne sme da ponovi poruku.
      expect((await sendPendingDigests('daily')).sent).toBe(0);
      expect(outbox).toHaveLength(1);
    });

    it('sledeći rezime obuhvata samo nove odgovore', async () => {
      const { invitationId } = await eventFor('daily');
      await addResponse(invitationId, { status: 'yes', adults: 2 });

      const prvi = new Date();
      await sendPendingDigests('daily', prvi);

      await addResponse(invitationId, { status: 'no' });

      const sutra = new Date(prvi.getTime() + 25 * 60 * 60 * 1000);
      await sendPendingDigests('daily', sutra);

      expect(outbox).toHaveLength(2);
      // Drugi rezime nosi samo ono što je stiglo posle prvog.
      expect(outbox[1]?.text).toContain('ne dolazi 1');
      expect(outbox[1]?.text).toContain('dolazi 0');
    });

    it('nedeljni rezime ne uzima korisnike sa dnevnim podešavanjem', async () => {
      const { invitationId } = await eventFor('daily');
      await addResponse(invitationId);

      const report = await sendPendingDigests('weekly');

      expect(report.sent).toBe(0);
      expect(outbox).toHaveLength(0);
    });

    it('neuspelo slanje ne pomera granicu', async () => {
      const { invitationId } = await eventFor('daily');
      await addResponse(invitationId);

      setEmailAdapter({
        name: 'pokvaren',
        async send() {
          return { ok: false as const, error: 'provajder nedostupan' };
        },
      });

      expect((await sendPendingDigests('daily')).sent).toBe(0);

      // Kada provajder proradi, isti odgovori se ipak pošalju.
      setEmailAdapter(adapter);
      expect((await sendPendingDigests('daily')).sent).toBe(1);
    });

    it('meko obrisan događaj ne ulazi u rezime', async () => {
      const { invitationId, eventId } = await eventFor('daily');
      await addResponse(invitationId);

      // Korisnik je obrisao događaj pre nego što je rezime otišao - odgovori na
      // njemu više nikoga ne zanimaju.
      await db
        .update(events)
        .set({ deletedAt: new Date() })
        .where(eq(events.id, eventId));

      const report = await sendPendingDigests('daily');

      expect(report.sent).toBe(0);
      expect(outbox).toHaveLength(0);
    });
  });
});
