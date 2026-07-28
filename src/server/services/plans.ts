import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { cache } from 'react';

import type { PlanFeatures } from '@/features/billing/entitlements';
import { db } from '@/server/db';
import { featurePlans } from '@/server/db/schema';

/**
 * Paketi za javni cenovnik.
 *
 * Isti izvor koji koristi entitlement sistem, pa cenovnik ne može da obeća
 * mogućnost koju aplikacija ne dozvoljava (zahtev 39.9).
 */
export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  features: PlanFeatures;
};

export const listActivePlans = cache(async (): Promise<PublicPlan[]> =>
  db
    .select({
      id: featurePlans.id,
      code: featurePlans.code,
      name: featurePlans.name,
      description: featurePlans.description,
      priceMinor: featurePlans.priceMinor,
      currency: featurePlans.currency,
      features: featurePlans.features,
    })
    .from(featurePlans)
    .where(eq(featurePlans.isActive, true))
    .orderBy(asc(featurePlans.sortOrder)),
);
