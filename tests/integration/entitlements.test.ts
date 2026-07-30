import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import { featurePlans, orders } from '@/server/db/schema';
import { createEvent } from '@/server/services/events';
import {
  currentUsage,
  getAccountEntitlements,
  getEventEntitlements,
} from '@/server/services/entitlements';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Paket se kupuje za jednu pozivnicu, ne za nalog (zahtev 17).
 *
 * Ovo je test koji čuva taj model: plaćanje jednog venčanja ne sme da otključa
 * sledeći događaj istog korisnika. Provera mora da bude integraciona jer je
 * suština u upitu nad `orders` - unit test bi proverio samo lažnu bazu.
 */
describe.skipIf(!hasTestDatabase)('prava po pozivnici', () => {
  let weddingTypeId: string;
  let premiumPlanId: string;

  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    const [premium] = await db
      .select({ id: featurePlans.id })
      .from(featurePlans)
      .where(eq(featurePlans.code, 'premium'))
      .limit(1);

    if (!premium) throw new Error('Premium paket nije zasejan.');
    premiumPlanId = premium.id;
  });

  const eventInput = (name: string) => ({
    eventTypeId: weddingTypeId,
    name,
    details: {},
    date: '2026-09-12',
    time: '13:00',
    timeZone: 'Europe/Belgrade',
    city: 'Beograd',
    venueName: 'Restoran Dunavski kej',
    primaryLocale: 'sr-Latn' as const,
  });

  /** Plaćena narudžbina za tačno jedan događaj. */
  async function payFor(userId: string, eventId: string): Promise<void> {
    await db.insert(orders).values({
      userId,
      eventId,
      planId: premiumPlanId,
      status: 'paid',
      subtotalMinor: 290000,
      totalMinor: 290000,
      currency: 'RSD',
      idempotencyKey: `test-paid-${eventId}`,
    });
  }

  it('bez plaćene narudžbine događaj je na besplatnom paketu', async () => {
    const user = await createTestUser();
    const event = await createEvent(user.id, eventInput('Milica i Stefan'));

    const entitlements = await getEventEntitlements(event.eventId);

    expect(entitlements.planCode).toBe('free');
    expect(entitlements.features.flags.publish).toBe(false);
  });

  it('plaćeni paket važi samo za događaj za koji je kupljen', async () => {
    const user = await createTestUser();
    const paid = await createEvent(user.id, eventInput('Venčanje'));
    const unpaid = await createEvent(user.id, eventInput('Krštenje'));

    await payFor(user.id, paid.eventId);

    const forPaid = await getEventEntitlements(paid.eventId);
    const forUnpaid = await getEventEntitlements(unpaid.eventId);

    expect(forPaid.planCode).toBe('premium');
    expect(forPaid.features.flags.seating).toBe(true);

    // Suština modela: drugi događaj istog korisnika ostaje besplatan.
    expect(forUnpaid.planCode).toBe('free');
    expect(forUnpaid.features.flags.seating).toBe(false);
  });

  it('narudžbina koja nije plaćena ne daje prava', async () => {
    const user = await createTestUser();
    const event = await createEvent(user.id, eventInput('Venčanje'));

    await db.insert(orders).values({
      userId: user.id,
      eventId: event.eventId,
      planId: premiumPlanId,
      status: 'pending',
      subtotalMinor: 290000,
      totalMinor: 290000,
      currency: 'RSD',
      idempotencyKey: `test-pending-${event.eventId}`,
    });

    const entitlements = await getEventEntitlements(event.eventId);
    expect(entitlements.planCode).toBe('free');
  });

  it('nalog nema svoj paket - uvek podrazumevani', async () => {
    const user = await createTestUser();
    const event = await createEvent(user.id, eventInput('Venčanje'));
    await payFor(user.id, event.eventId);

    const account = await getAccountEntitlements();
    expect(account.planCode).toBe('free');
  });

  it('plaćeni događaji se ne broje u kvotu nacrta', async () => {
    const user = await createTestUser();
    const paid = await createEvent(user.id, eventInput('Venčanje'));
    await createEvent(user.id, eventInput('Krštenje'));
    await createEvent(user.id, eventInput('Rođendan'));

    expect(await currentUsage(user.id, 'maxEvents')).toBe(3);

    await payFor(user.id, paid.eventId);

    // Korelisani podupit mora da poredi `orders.event_id` sa `events.id`; ako
    // bi kolona ostala nekvalifikovana, poređenje bi tiho bilo netačno i broj
    // bi ostao 3.
    expect(await currentUsage(user.id, 'maxEvents')).toBe(2);
  });

  it('kvota broji samo događaje vlasnika', async () => {
    const user = await createTestUser();
    const other = await createTestUser();

    await createEvent(user.id, eventInput('Venčanje'));
    await createEvent(other.id, eventInput('Tuđe venčanje'));

    expect(await currentUsage(user.id, 'maxEvents')).toBe(1);
  });
});
