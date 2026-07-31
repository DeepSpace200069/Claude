import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { cache } from 'react';

import { db } from '@/server/db';
import { eventTypes } from '@/server/db/schema';

import { cachedCatalogRead } from './catalog-cache';

/**
 * Katalog vrsta proslava.
 *
 * Čita se na više stranica u istom zahtevu (početna, čarobnjak, filteri), pa je
 * keširano po zahtevu da se isti upit ne ponavlja.
 */
export type EventTypeOption = {
  id: string;
  key: string;
  slug: string;
  labelKey: string;
  icon: string;
  detailFields: string[];
};

export const listActiveEventTypes = cache(
  cachedCatalogRead('vrste-dogadjaja', async (): Promise<EventTypeOption[]> =>
    db
      .select({
        id: eventTypes.id,
        key: eventTypes.key,
        slug: eventTypes.slug,
        labelKey: eventTypes.labelKey,
        icon: eventTypes.icon,
        detailFields: eventTypes.detailFields,
      })
      .from(eventTypes)
      .where(eq(eventTypes.isActive, true))
      .orderBy(asc(eventTypes.sortOrder)),
  ),
);

export const getEventTypeBySlug = cache(
  async (slug: string): Promise<EventTypeOption | null> => {
    const [row] = await db
      .select({
        id: eventTypes.id,
        key: eventTypes.key,
        slug: eventTypes.slug,
        labelKey: eventTypes.labelKey,
        icon: eventTypes.icon,
        detailFields: eventTypes.detailFields,
      })
      .from(eventTypes)
      .where(eq(eventTypes.slug, slug))
      .limit(1);

    return row ?? null;
  },
);
