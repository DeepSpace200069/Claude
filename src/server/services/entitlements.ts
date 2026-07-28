import 'server-only';

import { and, count, eq, isNull } from 'drizzle-orm';
import { cache } from 'react';

import {
  DEFAULT_PLANS,
  type Entitlements,
  type FeatureLimit,
} from '@/features/billing/entitlements';
import { db } from '@/server/db';
import { events, featurePlans, orders } from '@/server/db/schema';

/**
 * Razrešavanje prava korisnika (zahtev 18 i 39.9).
 *
 * Paket se određuje po najvišem plaćenom nalogu; bez plaćenog naloga korisnik
 * je na podrazumevanom besplatnom paketu. Vrednosti se čitaju iz baze da bi
 * administrator mogao da menja limite bez deploya.
 */
export const getUserEntitlements = cache(
  async (userId: string): Promise<Entitlements> => {
    const plans = await db
      .select({
        id: featurePlans.id,
        code: featurePlans.code,
        name: featurePlans.name,
        features: featurePlans.features,
        sortOrder: featurePlans.sortOrder,
        isDefault: featurePlans.isDefault,
      })
      .from(featurePlans)
      .where(eq(featurePlans.isActive, true));

    const fallback: Entitlements = {
      planCode: 'free',
      planName: 'Besplatan nacrt',
      features: DEFAULT_PLANS.free,
    };

    if (plans.length === 0) return fallback;

    const paidPlanIds = await db
      .select({ planId: orders.planId })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, 'paid')));

    const owned = new Set(paidPlanIds.map((row) => row.planId));

    // Najviši plaćeni paket; `sortOrder` određuje hijerarhiju paketa.
    const best = plans
      .filter((plan) => owned.has(plan.id))
      .sort((a, b) => b.sortOrder - a.sortOrder)[0];

    const chosen =
      best ??
      plans.find((plan) => plan.isDefault) ??
      plans.sort((a, b) => a.sortOrder - b.sortOrder)[0];

    if (!chosen) return fallback;

    return {
      planCode: chosen.code,
      planName: chosen.name,
      features: chosen.features,
    };
  },
);

/**
 * Trenutna potrošnja resursa za proveru limita.
 *
 * Broji se u bazi (`count(*)`), ne u aplikaciji: lista događaja može biti
 * paginirana, pa bi brojanje učitanih redova dalo pogrešan rezultat.
 */
export async function currentUsage(
  userId: string,
  limit: FeatureLimit,
): Promise<number> {
  switch (limit) {
    case 'maxEvents': {
      const [row] = await db
        .select({ value: count() })
        .from(events)
        .where(and(eq(events.ownerId, userId), isNull(events.deletedAt)));
      return row?.value ?? 0;
    }
    default:
      // Ostali limiti se broje u kontekstu jednog događaja i proveravaju se u
      // servisima koji taj kontekst imaju (galerija, gosti, saradnici).
      return 0;
  }
}
