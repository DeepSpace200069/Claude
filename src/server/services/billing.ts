import 'server-only';

import { createHash } from 'node:crypto';

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { PlanFeatures } from '@/features/billing/entitlements';
import { getEnv } from '@/lib/env';
import { db } from '@/server/db';
import {
  events,
  featurePlans,
  invitations,
  orders,
  payments,
  promoCodes,
  templates,
  webhookEvents,
} from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/authz/errors';
import { getPaymentAdapter } from '@/server/adapters/payments';
import {
  transition,
  type PaymentStatus,
  type WebhookVerification,
} from '@/server/adapters/payments/types';

import { writeAuditLog } from './audit';
import { coversTemplate } from './entitlements';
import { sendPaymentReceipt } from './notifications';

/**
 * Naplata objavljivanja (zahtev 17 i 39.7).
 *
 * Model je „paket po pozivnici”: narudžbina uvek nosi `event_id`, pa plaćanje
 * jednog venčanja ne otključava sledeći događaj. Prava se čitaju iz
 * `getEventEntitlements`, koji gleda upravo plaćene narudžbine tog događaja.
 *
 * **Idempotencija se ne oslanja na aplikacijsku logiku.** Tri jedinstvena
 * indeksa su prava odbrana:
 *
 * - `orders (idempotency_key)` - dvostruki klik na „Plati” ne pravi dve
 *   narudžbine,
 * - `payments (provider, provider_ref)` - ponovljen poziv provajderu ne pravi
 *   drugu uplatu,
 * - `webhook_events (provider, external_id)` - ponovljena isporuka webhooka ne
 *   primenjuje posledice dvaput.
 *
 * Kod ne pokušava da „prvo proveri pa upiše” (to je trka koju baza uvek
 * dobija): upisuje, hvata sudar jedinstvenog indeksa i vraća postojeći zapis.
 */

export type OrderSummary = {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  planCode: string;
  planName: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  promoCode: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

export type CheckoutResult = {
  order: OrderSummary;
  /** Gde korisnika treba poslati; `null` kada nema šta da se plati. */
  redirectUrl: string | null;
  /** Da li je paket već aktivan (ponovljen zahtev ili besplatna aktivacija). */
  alreadyPaid: boolean;
};

const UNIQUE_VIOLATION = '23505';

/**
 * Da li je greška sudar jedinstvenog indeksa.
 *
 * Drizzle umotava grešku drajvera u svoju (`Failed query: ...`), pa se pravi
 * `code` nalazi tek u `cause`. Zato se lanac uzroka prolazi do kraja - provera
 * samo gornjeg sloja bi uvek bila netačna i idempotencija bi tiho otkazala.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * Kanonski oblik promo koda.
 *
 * Kodovi se čuvaju i porede u velikim slovima, pa „prolece25” i „PROLECE25”
 * budu isti kod. Ista funkcija mora da se koristi i pri upisu iz admin panela -
 * inače bi kod upisan malim slovima bio nedostupan.
 */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Popust promo koda.
 *
 * Vraća i `null` kod bez greške samo kada kod nije unet; nevažeći kod je
 * greška, jer korisnik koji je otkucao kod mora da sazna da nije primenjen -
 * tiho ignorisanje bi delovalo kao prevara na računu.
 */
export async function resolvePromoCode(
  rawCode: string | null | undefined,
  subtotalMinor: number,
  now: Date = new Date(),
): Promise<{ id: string; code: string; discountMinor: number } | null> {
  const code = rawCode ? normalizePromoCode(rawCode) : '';
  if (!code) return null;

  const [row] = await db
    .select({
      id: promoCodes.id,
      code: promoCodes.code,
      kind: promoCodes.kind,
      value: promoCodes.value,
      maxRedemptions: promoCodes.maxRedemptions,
      redemptions: promoCodes.redemptions,
      validFrom: promoCodes.validFrom,
      validUntil: promoCodes.validUntil,
      isActive: promoCodes.isActive,
    })
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  const invalid = new ValidationError('Promo kod nije važeći.', {
    promoCode: ['Kod ne postoji ili više ne važi.'],
  });

  if (!row || !row.isActive) throw invalid;
  if (row.validFrom && row.validFrom > now) throw invalid;
  if (row.validUntil && row.validUntil < now) throw invalid;
  if (row.maxRedemptions !== null && row.redemptions >= row.maxRedemptions) {
    throw new ValidationError('Promo kod je iskorišćen.', {
      promoCode: ['Ovaj kod je već iskorišćen maksimalan broj puta.'],
    });
  }

  const discountMinor =
    row.kind === 'free'
      ? subtotalMinor
      : row.kind === 'percent'
        ? Math.round((subtotalMinor * Math.min(row.value, 100)) / 100)
        : Math.min(row.value, subtotalMinor);

  return { id: row.id, code: row.code, discountMinor };
}

type PlanRow = {
  id: string;
  code: string;
  name: string;
  /** Potrebno za proveru pokrivenosti šablona (`allTemplates`). */
  features: PlanFeatures;
  priceMinor: number;
  currency: string;
};

async function requirePurchasablePlan(planId: string): Promise<PlanRow> {
  const [plan] = await db
    .select({
      id: featurePlans.id,
      code: featurePlans.code,
      name: featurePlans.name,
      features: featurePlans.features,
      priceMinor: featurePlans.priceMinor,
      currency: featurePlans.currency,
      isActive: featurePlans.isActive,
    })
    .from(featurePlans)
    .where(eq(featurePlans.id, planId))
    .limit(1);

  if (!plan || !plan.isActive) throw new NotFoundError('Paket ne postoji.');

  if (plan.priceMinor <= 0) {
    throw new ValidationError('Ovaj paket se ne kupuje.', {
      planId: ['Izaberite paket koji se plaća.'],
    });
  }

  return plan;
}

async function requireInvitation(eventId: string): Promise<{
  invitationId: string;
  eventName: string;
  /** Paket koji traži izabrani šablon; `null` kada šablona nema. */
  templateRequiredPlanCode: string | null;
}> {
  const [row] = await db
    .select({
      invitationId: invitations.id,
      eventName: events.name,
      templateRequiredPlanCode: templates.requiredPlanCode,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    // Pozivnica sme da bude bez šablona, pa je ovo `leftJoin`.
    .leftJoin(templates, eq(invitations.templateId, templates.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError('Pozivnica ne postoji.');
  return row;
}

/**
 * Ključ idempotencije narudžbine.
 *
 * Izvodi se iz onoga što narudžbinu čini istom: događaj, paket i redni broj
 * pokušaja. Redni broj postoji da bi korisnik smeo da pokuša ponovo pošto mu
 * prethodna uplata nije uspela - bez njega bi ga jedinstveni indeks zauvek
 * zaključao na propali pokušaj.
 */
function orderIdempotencyKey(
  eventId: string,
  planId: string,
  attempt: number,
): string {
  return createHash('sha256')
    .update(`order:${eventId}:${planId}:${attempt}`)
    .digest('base64url');
}

async function summarize(orderId: string): Promise<OrderSummary> {
  const [row] = await db
    .select({
      id: orders.id,
      status: orders.status,
      planCode: featurePlans.code,
      planName: featurePlans.name,
      subtotalMinor: orders.subtotalMinor,
      discountMinor: orders.discountMinor,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      promoCode: promoCodes.code,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .innerJoin(featurePlans, eq(orders.planId, featurePlans.id))
    .leftJoin(promoCodes, eq(orders.promoCodeId, promoCodes.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) throw new NotFoundError('Narudžbina ne postoji.');
  return row;
}

/**
 * Narudžbina za objavljivanje jedne pozivnice.
 *
 * Ponovljen poziv sa istim ulazom vraća **istu** narudžbinu i isti nalog kod
 * provajdera; ne pravi drugu. Kada je paket za taj događaj već plaćen, ne
 * pravi se ništa - vraća se `alreadyPaid`, pa interfejs ne nudi drugo plaćanje
 * istog paketa.
 */
export async function startCheckout(input: {
  userId: string;
  eventId: string;
  planId: string;
  promoCode?: string | null;
  returnUrl: string;
}): Promise<CheckoutResult> {
  // Provajder se traži **pre** upisa narudžbine: fabrika odbija adapter koji ne
  // sme u produkciju, a narudžbina bez ijedne uplate iza sebe je samo smeće u
  // bazi i pogrešan trag u admin panelu.
  getPaymentAdapter();

  const plan = await requirePurchasablePlan(input.planId);
  const invitation = await requireInvitation(input.eventId);

  /*
   * Paket mora da pokrije šablon koji pozivnica koristi.
   *
   * Bez ove provere korisnik sa premium šablonom mogao bi da plati Standard, a
   * da mu objavljivanje zatim bude odbijeno - novac uzet, pozivnica
   * neobjavljena. Bolje je odbiti naplatu uz jasnu poruku koji paket treba.
   */
  if (invitation.templateRequiredPlanCode !== null) {
    const covered = await coversTemplate(
      { planCode: plan.code, planName: plan.name, features: plan.features },
      invitation.templateRequiredPlanCode,
    );

    if (!covered) {
      throw new ValidationError(
        `Izabrani šablon je uključen tek u paket „${invitation.templateRequiredPlanCode}”.`,
        {
          planId: [
            `Izaberite paket „${invitation.templateRequiredPlanCode}” ili viši.`,
          ],
        },
      );
    }
  }

  const existing = await db
    .select({ id: orders.id, status: orders.status, planId: orders.planId })
    .from(orders)
    .where(and(eq(orders.eventId, input.eventId), eq(orders.planId, input.planId)))
    .orderBy(desc(orders.createdAt));

  const paid = existing.find((row) => row.status === 'paid');
  if (paid) {
    return { order: await summarize(paid.id), redirectUrl: null, alreadyPaid: true };
  }

  const pending = existing.find((row) => row.status === 'pending');
  if (pending) {
    // Isti korisnik, isti paket, nezavršena narudžbina: nastavlja se ona, a ne
    // pravi nova. Provajder na isti ključ vrati isti nalog.
    return resumeCheckout(pending.id, input.returnUrl);
  }

  const promo = await resolvePromoCode(input.promoCode, plan.priceMinor);
  const discountMinor = promo?.discountMinor ?? 0;
  const totalMinor = Math.max(plan.priceMinor - discountMinor, 0);

  const attempt = existing.length;
  const key = orderIdempotencyKey(input.eventId, input.planId, attempt);

  let orderId: string;
  try {
    const [created] = await db
      .insert(orders)
      .values({
        userId: input.userId,
        eventId: input.eventId,
        invitationId: invitation.invitationId,
        planId: plan.id,
        promoCodeId: promo?.id ?? null,
        status: 'pending',
        subtotalMinor: plan.priceMinor,
        discountMinor,
        totalMinor,
        currency: plan.currency,
        idempotencyKey: key,
      })
      .returning({ id: orders.id });

    if (!created) throw new Error('Narudžbina nije napravljena.');
    orderId = created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Dva istovremena zahteva sa istim ključem: baza je propustila jedan,
    // drugi ovde pokupi rezultat pobednika.
    const [winner] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.idempotencyKey, key))
      .limit(1);

    if (!winner) throw error;
    return resumeCheckout(winner.id, input.returnUrl);
  }

  // Popust od 100% nije lažna uplata nego stvarno besplatna narudžbina, pa
  // provajder uopšte ne učestvuje.
  if (totalMinor === 0) {
    await settleOrder({ orderId, reason: 'promo' });
    return { order: await summarize(orderId), redirectUrl: null, alreadyPaid: true };
  }

  const redirectUrl = await ensurePaymentIntent({
    orderId,
    idempotencyKey: key,
    amountMinor: totalMinor,
    currency: plan.currency,
    description: `Objavljivanje pozivnice - ${invitation.eventName}`,
    returnUrl: input.returnUrl,
  });

  return { order: await summarize(orderId), redirectUrl, alreadyPaid: false };
}

/** Nastavak već napravljene narudžbine (osvežena stranica, drugi tab). */
async function resumeCheckout(
  orderId: string,
  returnUrl: string,
): Promise<CheckoutResult> {
  const order = await summarize(orderId);

  if (order.status === 'paid') {
    return { order, redirectUrl: null, alreadyPaid: true };
  }

  const [row] = await db
    .select({ idempotencyKey: orders.idempotencyKey })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) throw new NotFoundError('Narudžbina ne postoji.');

  const redirectUrl = await ensurePaymentIntent({
    orderId,
    idempotencyKey: row.idempotencyKey,
    amountMinor: order.totalMinor,
    currency: order.currency,
    description: 'Objavljivanje pozivnice',
    returnUrl,
  });

  return { order, redirectUrl, alreadyPaid: false };
}

/**
 * Nalog kod provajdera za datu narudžbinu.
 *
 * Adapter na isti ključ vraća isti `providerRef`, pa je red u `payments` ili
 * već tu, ili ga upisujemo - a sudar jedinstvenog indeksa znači da ga je
 * upisao paralelan zahtev i da nema šta da se popravlja.
 */
async function ensurePaymentIntent(input: {
  orderId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  description: string;
  returnUrl: string;
}): Promise<string | null> {
  const adapter = getPaymentAdapter();

  const intent = await adapter.createIntent({
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
    idempotencyKey: input.idempotencyKey,
    returnUrl: input.returnUrl,
  });

  try {
    await db.insert(payments).values({
      orderId: input.orderId,
      provider: adapter.name,
      providerRef: intent.providerRef,
      status: intent.status,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  return intent.redirectUrl;
}

/**
 * Prelazak narudžbine u `paid`.
 *
 * Cela promena je u jednoj transakciji sa `select ... for update` nad
 * narudžbinom: dva webhooka koja stignu u istoj sekundi ne smeju da uvećaju
 * broj iskorišćenja promo koda dvaput.
 */
export async function settleOrder(input: {
  orderId: string;
  reason: 'payment' | 'promo' | 'admin';
  actor?: { id: string; email: string | null } | null;
}): Promise<{ changed: boolean }> {
  const result = await settleOrderTransaction(input);

  /*
   * Potvrda se šalje **posle** transakcije i van nje: sporo ili neuspelo slanje
   * ne sme da drži zaključan red narudžbine niti da poništi naplatu koja je
   * prošla. Ponovljena isporuka webhooka ovde ne stiže - `changed` je tada
   * `false`.
   */
  if (result.changed) {
    await sendPaymentReceipt(input.orderId).catch(() => false);
  }

  return result;
}

async function settleOrderTransaction(input: {
  orderId: string;
  reason: 'payment' | 'promo' | 'admin';
  actor?: { id: string; email: string | null } | null;
}): Promise<{ changed: boolean }> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        promoCodeId: orders.promoCodeId,
        eventId: orders.eventId,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .for('update')
      .limit(1);

    if (!order) throw new NotFoundError('Narudžbina ne postoji.');

    // Ponovljena isporuka: nema šta da se menja, i to nije greška.
    if (order.status === 'paid') return { changed: false };

    if (order.status === 'refunded' || order.status === 'canceled') {
      throw new ValidationError(
        `Narudžbina u stanju „${order.status}” ne može da se naplati.`,
      );
    }

    await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(orders.id, order.id));

    if (order.promoCodeId) {
      await tx
        .update(promoCodes)
        .set({ redemptions: sql`${promoCodes.redemptions} + 1` })
        .where(eq(promoCodes.id, order.promoCodeId));
    }

    await writeAuditLog(
      {
        action: `order.paid.${input.reason}`,
        entityType: 'order',
        entityId: order.id,
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        changes: { eventId: order.eventId, reason: input.reason },
      },
      tx,
    );

    return { changed: true };
  });
}

/** Neuspela ili otkazana naplata; narudžbina ostaje kao trag pokušaja. */
export async function failOrder(
  orderId: string,
  status: 'failed' | 'canceled',
): Promise<void> {
  await db
    .update(orders)
    .set({ status, canceledAt: status === 'canceled' ? new Date() : null })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
}

/**
 * Obrada webhooka provajdera (zahtev 39.7).
 *
 * Redosled je namerno ovakav: prvo potpis, pa upis u `webhook_events`, pa tek
 * onda posledice. Upis je taj koji pravi idempotenciju - ponovljena isporuka
 * pada na jedinstvenom indeksu i vraća `duplicate`, bez ijedne izmene stanja.
 */
export type WebhookOutcome =
  | { ok: true; result: 'applied' | 'duplicate' | 'ignored' }
  | { ok: false; error: string };

export async function handlePaymentWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  const adapter = getPaymentAdapter();
  const verified: WebhookVerification = adapter.verifyWebhook(rawBody, signature);

  if (!verified.ok) return { ok: false, error: verified.error };

  try {
    await db.insert(webhookEvents).values({
      provider: adapter.name,
      externalId: verified.eventId,
      type: verified.type,
      payload: verified.payload,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: true, result: 'duplicate' };
    throw error;
  }

  try {
    const result = await applyPaymentStatus(
      adapter.name,
      verified.providerRef,
      verified.status,
      verified.payload,
    );

    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(
        and(
          eq(webhookEvents.provider, adapter.name),
          eq(webhookEvents.externalId, verified.eventId),
        ),
      );

    return { ok: true, result };
  } catch (error) {
    // Greška u primeni se pamti uz sam događaj; `processed_at` ostaje prazan,
    // pa se vidi šta nije obrađeno i može da se ponovi ručno.
    await db
      .update(webhookEvents)
      .set({ error: error instanceof Error ? error.message : String(error) })
      .where(
        and(
          eq(webhookEvents.provider, adapter.name),
          eq(webhookEvents.externalId, verified.eventId),
        ),
      );

    throw error;
  }
}

/**
 * Primena stanja naplate na uplatu i narudžbinu.
 *
 * Nepoznat `providerRef` se **ne** ignoriše tiho: to znači da provajder zna za
 * uplatu za koju mi ne znamo, što je stvar za istragu, a ne za tišinu.
 */
async function applyPaymentStatus(
  provider: string,
  providerRef: string,
  status: PaymentStatus,
  payload: Record<string, unknown>,
): Promise<'applied' | 'ignored'> {
  const [payment] = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      status: payments.status,
    })
    .from(payments)
    .where(and(eq(payments.provider, provider), eq(payments.providerRef, providerRef)))
    .limit(1);

  if (!payment) {
    throw new NotFoundError(`Uplata ${providerRef} ne postoji u bazi.`);
  }

  const next = transition(payment.status, status);
  if (!next.ok) {
    // Webhookovi stižu van redosleda: „succeeded” pa „pending” nije greška
    // provajdera nego zakasneli raniji događaj, pa se odbacuje bez izmene.
    return 'ignored';
  }

  if (payment.status === status) return 'ignored';

  await db
    .update(payments)
    .set({
      status,
      rawPayload: payload,
      processedAt: new Date(),
      failureReason:
        status === 'failed' ? String(payload.failureReason ?? 'Nepoznat razlog.') : null,
    })
    .where(eq(payments.id, payment.id));

  if (status === 'succeeded') {
    await settleOrder({ orderId: payment.orderId, reason: 'payment' });
  } else if (status === 'failed') {
    await failOrder(payment.orderId, 'failed');
  } else if (status === 'refunded') {
    await refundOrder(payment.orderId);
  }

  return 'applied';
}

/**
 * Povraćaj novca.
 *
 * Narudžbina prelazi u `refunded`, čime događaj **gubi** plaćeni paket - to je
 * i smisao: `getEventEntitlements` gleda samo narudžbine u stanju `paid`.
 */
export async function refundOrder(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ status: 'refunded' })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ['paid', 'pending'])));
}

/** Narudžbine jednog događaja - za stranicu „plan i naplata”. */
export async function listOrdersForEvent(eventId: string): Promise<OrderSummary[]> {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      planCode: featurePlans.code,
      planName: featurePlans.name,
      subtotalMinor: orders.subtotalMinor,
      discountMinor: orders.discountMinor,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      promoCode: promoCodes.code,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .innerJoin(featurePlans, eq(orders.planId, featurePlans.id))
    .leftJoin(promoCodes, eq(orders.promoCodeId, promoCodes.id))
    .where(eq(orders.eventId, eventId))
    .orderBy(desc(orders.createdAt));
}

/**
 * URL na koji provajder vraća korisnika posle plaćanja.
 *
 * Vraća se na stranicu naplate, a ne na objavljivanje: tu se vidi stanje
 * narudžbine, pa korisnik čija uplata još nije potvrđena dobija odgovor na
 * pitanje „je li prošlo”, umesto dugmeta koje i dalje ne radi.
 */
export function checkoutReturnUrl(eventId: string): string {
  return `${getEnv().APP_URL}/app/dogadjaji/${eventId}/naplata?naplata=povratak`;
}
