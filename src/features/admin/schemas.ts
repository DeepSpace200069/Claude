import { z } from 'zod';

import { planFeaturesSchema } from '@/features/billing/entitlements';

/**
 * Ulazi administrativnih radnji (zahtev 19).
 *
 * Svaka radnja koja menja novac ili prava traži i razlog: audit log bez razloga
 * kaže šta se desilo, ali ne i zašto, pa je pola godine kasnije beskoristan.
 */

export const setUserRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['user', 'admin']),
});

export const activateOrderSchema = z.object({
  orderId: z.uuid(),
  reason: z.string().trim().min(3, 'Unesite razlog aktivacije.').max(500),
});

export const updatePlanSchema = z.object({
  planId: z.uuid(),
  name: z.string().trim().min(1, 'Naziv je obavezan.').max(80),
  description: z.string().trim().max(400).default(''),
  priceMinor: z.coerce.number().int().min(0, 'Cena ne može biti negativna.'),
  isActive: z.boolean(),
  features: planFeaturesSchema,
});

export const templateVersionSchema = z.object({
  templateId: z.uuid(),
  versionId: z.uuid(),
});

export const templateStatusSchema = z.object({
  templateId: z.uuid(),
  status: z.enum(['draft', 'published', 'archived']),
});

export const eventTypeActiveSchema = z.object({
  eventTypeId: z.uuid(),
  isActive: z.boolean(),
});

export const createPromoCodeSchema = z.object({
  code: z.string().trim().min(3, 'Kod mora imati bar tri znaka.').max(40),
  kind: z.enum(['percent', 'fixed', 'free']),
  value: z.coerce.number().int().min(0).default(0),
  maxRedemptions: z.coerce.number().int().min(1).nullable().default(null),
  /** Prazan datum znači „bez roka”, a ne „istekao danas”. */
  validUntil: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(`${value}T23:59:59Z`) : null)),
});

export const promoCodeActiveSchema = z.object({
  promoCodeId: z.uuid(),
  isActive: z.boolean(),
});

export type UpdatePlanInput = z.input<typeof updatePlanSchema>;
export type CreatePromoCodeInput = z.input<typeof createPromoCodeSchema>;
