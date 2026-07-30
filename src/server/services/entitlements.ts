import 'server-only';

import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { cache } from 'react';

import {
  DEFAULT_PLANS,
  type Entitlements,
  type FeatureLimit,
} from '@/features/billing/entitlements';
import { db } from '@/server/db';
import { events, featurePlans, orders } from '@/server/db/schema';

/**
 * Razrešavanje prava (zahtev 17, 18 i 39.9).
 *
 * **Paket se kupuje za jednu pozivnicu, ne za nalog.** To je model koji
 * cenovnik obećava („Plaćate jednom, po događaju”) i koji šema već podržava
 * (`orders.event_id`). Zato prava razrešava `getEventEntitlements(eventId)`, a
 * ne korisnik: neko ko je platio venčanje ne dobija automatski i krštenje
 * sledeće godine.
 *
 * Jedini limit koji ostaje na nivou naloga je broj događaja - vidi
 * `currentUsage`.
 *
 * Vrednosti se čitaju iz baze da bi administrator mogao da menja limite bez
 * deploya.
 */

type PlanRow = {
  id: string;
  code: string;
  name: string;
  features: Entitlements['features'];
  sortOrder: number;
  isDefault: boolean;
};

const FALLBACK: Entitlements = {
  planCode: 'free',
  planName: 'Besplatan nacrt',
  features: DEFAULT_PLANS.free,
};

/**
 * Aktivni paketi iz baze.
 *
 * `cache()` znači jedno čitanje po zahtevu, koliko god stranica i akcija ih
 * zatražilo.
 */
const activePlans = cache(async (): Promise<PlanRow[]> =>
  db
    .select({
      id: featurePlans.id,
      code: featurePlans.code,
      name: featurePlans.name,
      features: featurePlans.features,
      sortOrder: featurePlans.sortOrder,
      isDefault: featurePlans.isDefault,
    })
    .from(featurePlans)
    .where(eq(featurePlans.isActive, true)),
);

function defaultPlan(plans: readonly PlanRow[]): Entitlements {
  const chosen =
    plans.find((plan) => plan.isDefault) ??
    [...plans].sort((a, b) => a.sortOrder - b.sortOrder)[0];

  if (!chosen) return FALLBACK;

  return {
    planCode: chosen.code,
    planName: chosen.name,
    features: chosen.features,
  };
}

/**
 * Prava za jedan događaj.
 *
 * Uzima najviši **plaćeni** paket kupljen baš za taj događaj; bez plaćene
 * narudžbine važi podrazumevani besplatni paket. Hijerarhiju određuje
 * `sortOrder`, pa nadogradnja sa Standarda na Premium ne traži poništavanje
 * ranije narudžbine.
 */
export const getEventEntitlements = cache(
  async (eventId: string): Promise<Entitlements> => {
    const plans = await activePlans();
    if (plans.length === 0) return FALLBACK;

    const paid = await db
      .select({ planId: orders.planId })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), eq(orders.status, 'paid')));

    if (paid.length === 0) return defaultPlan(plans);

    const owned = new Set(paid.map((row) => row.planId));
    const best = plans
      .filter((plan) => owned.has(plan.id))
      .sort((a, b) => b.sortOrder - a.sortOrder)[0];

    if (!best) return defaultPlan(plans);

    return {
      planCode: best.code,
      planName: best.name,
      features: best.features,
    };
  },
);

/**
 * Prava na nivou naloga.
 *
 * U modelu „paket po pozivnici” nalog nema svoj paket, pa je ovo uvek
 * podrazumevani besplatni paket. Postoji kao zasebna funkcija da bi bilo
 * očigledno **koji** limit se gde proverava: jedini limit naloga je broj
 * događaja.
 */
export const getAccountEntitlements = cache(
  async (): Promise<Entitlements> => defaultPlan(await activePlans()),
);

/**
 * Trenutna potrošnja resursa za proveru limita.
 *
 * Broji se u bazi (`count(*)`), ne u aplikaciji: lista događaja može biti
 * paginirana, pa bi brojanje učitanih redova dalo pogrešan rezultat.
 *
 * **Plaćeni događaji se ne broje u kvotu.** Kvota postoji da neograničeno
 * pravljenje besplatnih nacrta ne bi bilo način da se sistem zatrpa; ko je
 * platio pet venčanja, nema razloga da mu šesto bude zabranjeno.
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
        .where(
          and(
            eq(events.ownerId, userId),
            isNull(events.deletedAt),
            sql`not exists (
              select 1 from orders o
              where o.event_id = ${events.id} and o.status = 'paid'
            )`,
          ),
        );
      return row?.value ?? 0;
    }
    default:
      // Ostali limiti se broje u kontekstu jednog događaja i proveravaju se u
      // servisima koji taj kontekst imaju (galerija, gosti, saradnici).
      return 0;
  }
}
