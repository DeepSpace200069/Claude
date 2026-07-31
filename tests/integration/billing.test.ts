import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/server/db';
import { auditLogs, featurePlans, orders, payments, promoCodes } from '@/server/db/schema';
import { DevPaymentAdapter, setPaymentAdapter } from '@/server/adapters/payments';
import { ValidationError } from '@/server/authz/errors';
import {
  handlePaymentWebhook,
  listOrdersForEvent,
  normalizePromoCode,
  startCheckout,
} from '@/server/services/billing';
import { getEventEntitlements } from '@/server/services/entitlements';
import { createEvent } from '@/server/services/events';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Naplata objavljivanja (zahtev 17 i 39.7).
 *
 * Težište je na idempotenciji: dvostruki klik, ponovljen webhook i webhook van
 * redosleda ne smeju da naprave drugu narudžbinu, drugu uplatu, niti da
 * uvećaju broj iskorišćenja promo koda dvaput.
 */
describe.skipIf(!hasTestDatabase)('naplata objavljivanja', () => {
  const adapter = new DevPaymentAdapter({ webhookSecret: 'test-webhook-secret' });

  let weddingTypeId: string;
  let premiumPlanId: string;
  let premiumPrice: number;

  beforeAll(async () => {
    setPaymentAdapter(adapter);
    await truncateAll();
  });

  afterAll(() => {
    setPaymentAdapter(null);
  });

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    const [premium] = await db
      .select({ id: featurePlans.id, priceMinor: featurePlans.priceMinor })
      .from(featurePlans)
      .where(eq(featurePlans.code, 'premium'))
      .limit(1);

    if (!premium) throw new Error('Premium paket nije zasejan.');
    premiumPlanId = premium.id;
    premiumPrice = premium.priceMinor;
    expect(premiumPrice).toBeGreaterThan(0);
  });

  async function newEvent(name = 'Milica i Stefan'): Promise<string> {
    const user = await createTestUser();
    const event = await createEvent(user.id, {
      eventTypeId: weddingTypeId,
      name,
      details: {},
      date: '2026-09-12',
      time: '13:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Restoran Dunavski kej',
      primaryLocale: 'sr-Latn',
    });
    return event.eventId;
  }

  /** Webhook kakav bi provajder poslao, sa ispravnim potpisom. */
  async function deliverWebhook(
    providerRef: string,
    status: string,
    eventId = `evt_${providerRef}_${status}`,
  ) {
    const body = JSON.stringify({
      id: eventId,
      type: `payment.${status}`,
      providerRef,
      status,
      amountMinor: premiumPrice,
    });
    return handlePaymentWebhook(body, adapter.signPayload(body));
  }

  async function providerRefFor(eventId: string): Promise<string> {
    const [row] = await db
      .select({ providerRef: payments.providerRef, orderId: payments.orderId })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(orders.eventId, eventId))
      .limit(1);

    if (!row?.providerRef) throw new Error('Uplata nema referencu provajdera.');
    return row.providerRef;
  }

  it('pravi narudžbinu u čekanju i nalog kod provajdera', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();

    const result = await startCheckout({
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    });

    expect(result.alreadyPaid).toBe(false);
    expect(result.order.status).toBe('pending');
    expect(result.order.totalMinor).toBe(premiumPrice);
    expect(result.redirectUrl).toBe('http://localhost:3000/povratak');

    // Do uplate, događaj ostaje na besplatnom paketu - nema „unapred datog” prava.
    const entitlements = await getEventEntitlements(eventId);
    expect(entitlements.planCode).toBe('free');
  });

  it('dvostruki klik ne pravi drugu narudžbinu ni drugu uplatu', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();
    const input = {
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    };

    const first = await startCheckout(input);
    const second = await startCheckout(input);

    expect(second.order.id).toBe(first.order.id);

    const allOrders = await listOrdersForEvent(eventId);
    expect(allOrders).toHaveLength(1);

    const rows = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.orderId, first.order.id));
    expect(rows).toHaveLength(1);
  });

  it('uspešan webhook aktivira paket baš za taj događaj', async () => {
    const eventId = await newEvent();
    const other = await newEvent('Krštenje');
    const user = await createTestUser();

    await startCheckout({
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    });

    const outcome = await deliverWebhook(await providerRefFor(eventId), 'succeeded');
    expect(outcome).toEqual({ ok: true, result: 'applied' });

    expect((await getEventEntitlements(eventId)).planCode).toBe('premium');
    expect((await getEventEntitlements(other)).planCode).toBe('free');

    const [order] = await listOrdersForEvent(eventId);
    expect(order?.status).toBe('paid');
    expect(order?.paidAt).toBeInstanceOf(Date);
  });

  it('ponovljen webhook ne menja ništa drugi put', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();
    await startCheckout({
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    });

    const ref = await providerRefFor(eventId);
    const first = await deliverWebhook(ref, 'succeeded', 'evt-isti');
    const second = await deliverWebhook(ref, 'succeeded', 'evt-isti');

    expect(first).toEqual({ ok: true, result: 'applied' });
    expect(second).toEqual({ ok: true, result: 'duplicate' });

    // Jedan zapis o naplati, ne dva.
    const paidEntries = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.action, 'order.paid.payment'));
    expect(paidEntries).toHaveLength(1);
  });

  it('zakasneli „pending” posle uspeha se odbacuje', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();
    await startCheckout({
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    });

    const ref = await providerRefFor(eventId);
    await deliverWebhook(ref, 'succeeded');
    const late = await deliverWebhook(ref, 'pending');

    expect(late).toEqual({ ok: true, result: 'ignored' });
    expect((await getEventEntitlements(eventId)).planCode).toBe('premium');
  });

  it('odbija webhook sa neispravnim potpisom i ne pamti ga', async () => {
    const body = JSON.stringify({
      id: 'evt-lazni',
      providerRef: 'dev_nepostojeci',
      status: 'succeeded',
    });

    const outcome = await handlePaymentWebhook(body, 'pogresan-potpis');
    expect(outcome.ok).toBe(false);
  });

  it('neuspela uplata ostavlja narudžbinu neplaćenom, a novi pokušaj je dozvoljen', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();
    const input = {
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    };

    const first = await startCheckout(input);
    await deliverWebhook(await providerRefFor(eventId), 'failed');

    const afterFailure = await listOrdersForEvent(eventId);
    expect(afterFailure[0]?.status).toBe('failed');

    // Ključ idempotencije nosi redni broj pokušaja, pa propao pokušaj ne
    // zaključava korisnika zauvek.
    const retry = await startCheckout(input);
    expect(retry.order.id).not.toBe(first.order.id);
    expect(retry.order.status).toBe('pending');
  });

  it('plaćen paket se ne naplaćuje drugi put', async () => {
    const eventId = await newEvent();
    const user = await createTestUser();
    const input = {
      userId: user.id,
      eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/povratak',
    };

    await startCheckout(input);
    await deliverWebhook(await providerRefFor(eventId), 'succeeded');

    const again = await startCheckout(input);
    expect(again.alreadyPaid).toBe(true);
    expect(again.redirectUrl).toBeNull();
    expect(await listOrdersForEvent(eventId)).toHaveLength(1);
  });

  describe('promo kodovi', () => {
    async function seedPromo(
      kind: 'percent' | 'fixed' | 'free',
      value: number,
      overrides: Partial<{ maxRedemptions: number; isActive: boolean; validUntil: Date }> = {},
    ): Promise<string> {
      // Kodovi se čuvaju u kanonskom obliku, isto kao što ih upisuje admin panel.
      const [row] = await db
        .insert(promoCodes)
        .values({
          code: normalizePromoCode(`kod-${kind}-${value}`),
          kind,
          value,
          ...overrides,
        })
        .returning({ code: promoCodes.code });
      if (!row) throw new Error('Promo kod nije napravljen.');
      return row.code;
    }

    it('procentualni popust umanjuje iznos', async () => {
      const code = await seedPromo('percent', 20);
      const eventId = await newEvent();
      const user = await createTestUser();

      const result = await startCheckout({
        userId: user.id,
        eventId,
        planId: premiumPlanId,
        promoCode: code.toLowerCase(),
        returnUrl: 'http://localhost:3000/povratak',
      });

      expect(result.order.discountMinor).toBe(Math.round(premiumPrice * 0.2));
      expect(result.order.totalMinor).toBe(premiumPrice - result.order.discountMinor);
    });

    it('kod koji pokriva ceo iznos aktivira paket bez provajdera', async () => {
      const code = await seedPromo('free', 0);
      const eventId = await newEvent();
      const user = await createTestUser();

      const result = await startCheckout({
        userId: user.id,
        eventId,
        planId: premiumPlanId,
        promoCode: code,
        returnUrl: 'http://localhost:3000/povratak',
      });

      expect(result.order.totalMinor).toBe(0);
      expect(result.alreadyPaid).toBe(true);
      expect((await getEventEntitlements(eventId)).planCode).toBe('premium');

      // Nema uplate jer nije bilo šta da se naplati.
      const rows = await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.orderId, result.order.id));
      expect(rows).toHaveLength(0);

      const [promo] = await db
        .select({ redemptions: promoCodes.redemptions })
        .from(promoCodes)
        .where(eq(promoCodes.code, code));
      expect(promo?.redemptions).toBe(1);
    });

    it('nevažeći kod je greška, a ne tiho ignorisanje', async () => {
      const eventId = await newEvent();
      const user = await createTestUser();

      await expect(
        startCheckout({
          userId: user.id,
          eventId,
          planId: premiumPlanId,
          promoCode: 'NEPOSTOJECI',
          returnUrl: 'http://localhost:3000/povratak',
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(await listOrdersForEvent(eventId)).toHaveLength(0);
    });

    it('iskorišćen kod se odbija', async () => {
      const code = await seedPromo('percent', 10, { maxRedemptions: 1 });
      await db
        .update(promoCodes)
        .set({ redemptions: 1 })
        .where(eq(promoCodes.code, code));

      const eventId = await newEvent();
      const user = await createTestUser();

      await expect(
        startCheckout({
          userId: user.id,
          eventId,
          planId: premiumPlanId,
          promoCode: code,
          returnUrl: 'http://localhost:3000/povratak',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('istekao kod se odbija', async () => {
      const code = await seedPromo('fixed', 1000, {
        validUntil: new Date('2020-01-01T00:00:00Z'),
      });
      const eventId = await newEvent();
      const user = await createTestUser();

      await expect(
        startCheckout({
          userId: user.id,
          eventId,
          planId: premiumPlanId,
          promoCode: code,
          returnUrl: 'http://localhost:3000/povratak',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  it('besplatan paket ne može da se kupi', async () => {
    const [free] = await db
      .select({ id: featurePlans.id })
      .from(featurePlans)
      .where(eq(featurePlans.code, 'free'))
      .limit(1);

    const eventId = await newEvent();
    const user = await createTestUser();

    await expect(
      startCheckout({
        userId: user.id,
        eventId,
        planId: free?.id ?? '',
        returnUrl: 'http://localhost:3000/povratak',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('webhook za nepoznatu uplatu ne prolazi tiho', async () => {
    await expect(deliverWebhook('dev_nepostojeci_ref', 'succeeded')).rejects.toThrow(
      /ne postoji/,
    );
  });
});
