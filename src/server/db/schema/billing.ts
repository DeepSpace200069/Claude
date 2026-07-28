import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { PlanFeatures } from '@/features/billing/entitlements';

import { primaryId, timestamps } from './_shared';
import { users } from './auth';
import { events } from './events';
import { invitations } from './invitations';
import { orderStatusEnum, paymentStatusEnum, promoKindEnum } from './enums';

/**
 * Paketi i njihova ograničenja (zahtev 18).
 *
 * Limiti se čitaju isključivo odavde - nijedna komponenta ne sme da ima
 * hardkodovan limit (zahtev 39.9).
 */
export const featurePlans = pgTable(
  'feature_plans',
  {
    id: primaryId,
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /** Cena u najmanjoj jedinici valute (para/cent). */
    priceMinor: integer('price_minor').notNull().default(0),
    currency: text('currency').notNull().default('RSD'),
    /** Mogućnosti i limiti; oblik validira `planFeaturesSchema`. */
    features: jsonb('features').$type<PlanFeatures>().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('feature_plans_code_unique').on(table.code),
    index('feature_plans_active_idx').on(table.isActive, table.sortOrder),
  ],
);

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: primaryId,
    code: text('code').notNull(),
    kind: promoKindEnum('kind').notNull(),
    /** Procenat (1-100) ili fiksni iznos u najmanjoj jedinici valute. */
    value: integer('value').notNull().default(0),
    maxRedemptions: integer('max_redemptions'),
    redemptions: integer('redemptions').notNull().default(0),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('promo_codes_code_unique').on(table.code)],
);

/**
 * Narudžbina za objavljivanje pozivnice.
 *
 * Model je „plaća se objavljivanje” (zahtev 17): nacrt i pregled su besplatni,
 * a javni link se aktivira tek kada narudžbina pređe u `paid`.
 */
export const orders = pgTable(
  'orders',
  {
    id: primaryId,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id').references(() => events.id, {
      onDelete: 'set null',
    }),
    invitationId: uuid('invitation_id').references(() => invitations.id, {
      onDelete: 'set null',
    }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => featurePlans.id, { onDelete: 'restrict' }),
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, {
      onDelete: 'set null',
    }),

    status: orderStatusEnum('status').notNull().default('pending'),
    subtotalMinor: integer('subtotal_minor').notNull(),
    discountMinor: integer('discount_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull(),
    currency: text('currency').notNull().default('RSD'),

    /**
     * Ključ idempotencije (zahtev 39.7): isti ključ nikad ne sme da napravi
     * dve narudžbine niti da dvaput naplati.
     */
    idempotencyKey: text('idempotency_key').notNull(),

    paidAt: timestamp('paid_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('orders_idempotency_key_unique').on(table.idempotencyKey),
    index('orders_user_idx').on(table.userId, table.createdAt),
    index('orders_invitation_idx').on(table.invitationId),
    index('orders_status_idx').on(table.status),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: primaryId,
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    /** Identifikator transakcije kod provajdera. */
    providerRef: text('provider_ref'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('RSD'),
    /** Neizmenjen odgovor provajdera - potreban za reklamacije i reviziju. */
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    failureReason: text('failure_reason'),
    refundedAmountMinor: integer('refunded_amount_minor').notNull().default(0),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('payments_order_idx').on(table.orderId),
    // Isti događaj provajdera sme da se obradi tačno jednom.
    uniqueIndex('payments_provider_ref_unique').on(
      table.provider,
      table.providerRef,
    ),
  ],
);

/**
 * Obrađeni webhook događaji.
 *
 * Provajderi ponavljaju isporuku dok ne dobiju 2xx, pa je ovo tabela koja
 * garantuje da se posledice primene tačno jednom.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: primaryId,
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('webhook_events_provider_external_unique').on(
      table.provider,
      table.externalId,
    ),
  ],
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  plan: one(featurePlans, {
    fields: [orders.planId],
    references: [featurePlans.id],
  }),
  invitation: one(invitations, {
    fields: [orders.invitationId],
    references: [invitations.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
