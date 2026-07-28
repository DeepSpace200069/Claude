import 'server-only';

import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { cache } from 'react';

import type { ThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import { eventTypes, templateVersions, templates } from '@/server/db/schema';

/**
 * Čitanje šablona za galeriju i demo stranice.
 *
 * Galerija uvek prikazuje **objavljenu** verziju: nacrt vidi samo administrator
 * u panelu (Faza 7). Zbog toga svaki upit ovde spaja `templates` sa verzijom na
 * koju pokazuje `published_version_id`.
 */
export type TemplateSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  style: string;
  dominantColor: string;
  usesPhotos: boolean;
  isFeatured: boolean;
  requiredPlanCode: string;
  sortOrder: number;
  eventTypeKey: string;
  eventTypeSlug: string;
  eventTypeLabelKey: string;
  themeTokens: ThemeTokens;
};

export type TemplateFilters = {
  eventTypeSlug?: string;
  style?: string;
  /** Filtriranje po dominantnoj boji kroz imenovane grupe, ne po tačnom heksu. */
  colorGroup?: string;
  usesPhotos?: boolean;
  sort?: 'preporuceni' | 'najnoviji' | 'naziv';
};

const summarySelection = {
  id: templates.id,
  slug: templates.slug,
  name: templates.name,
  description: templates.description,
  style: templates.style,
  dominantColor: templates.dominantColor,
  usesPhotos: templates.usesPhotos,
  isFeatured: templates.isFeatured,
  requiredPlanCode: templates.requiredPlanCode,
  sortOrder: templates.sortOrder,
  createdAt: templates.createdAt,
  eventTypeKey: eventTypes.key,
  eventTypeSlug: eventTypes.slug,
  eventTypeLabelKey: eventTypes.labelKey,
  themeTokens: templateVersions.themeTokens,
} as const;

export const listTemplates = cache(
  async (filters: TemplateFilters = {}): Promise<TemplateSummary[]> => {
    const conditions: SQL[] = [eq(templates.status, 'published')];

    if (filters.eventTypeSlug) {
      conditions.push(eq(eventTypes.slug, filters.eventTypeSlug));
    }
    if (filters.style) {
      conditions.push(eq(templates.style, filters.style));
    }
    if (filters.usesPhotos !== undefined) {
      conditions.push(eq(templates.usesPhotos, filters.usesPhotos));
    }

    const rows = await db
      .select(summarySelection)
      .from(templates)
      .innerJoin(eventTypes, eq(templates.eventTypeId, eventTypes.id))
      .innerJoin(
        templateVersions,
        eq(templates.publishedVersionId, templateVersions.id),
      )
      .where(and(...conditions))
      .orderBy(
        ...(filters.sort === 'naziv'
          ? [asc(templates.name)]
          : filters.sort === 'najnoviji'
            ? [desc(templates.createdAt)]
            : // Podrazumevano: izdvojeni prvi, pa ručno zadat redosled.
              [desc(templates.isFeatured), asc(templates.sortOrder)]),
      );

    // Boja se filtrira u aplikaciji: grupisanje heks vrednosti u imenovane
    // grupe je logika prikaza, a ne nešto što baza treba da zna.
    const filtered = filters.colorGroup
      ? rows.filter((row) => colorGroupOf(row.dominantColor) === filters.colorGroup)
      : rows;

    return filtered.map(({ createdAt: _createdAt, ...rest }) => rest);
  },
);

export type TemplateDetail = TemplateSummary & {
  versionId: string;
  version: number;
  sections: Array<{
    type: string;
    schemaVersion: number;
    position: number;
    isVisible: boolean;
    data: unknown;
  }>;
  demoContext: Record<string, unknown> | null;
};

export const getTemplateBySlug = cache(
  async (slug: string): Promise<TemplateDetail | null> => {
    const [row] = await db
      .select({
        ...summarySelection,
        versionId: templateVersions.id,
        version: templateVersions.version,
        sections: templateVersions.sections,
        demoContext: templateVersions.demoContext,
      })
      .from(templates)
      .innerJoin(eventTypes, eq(templates.eventTypeId, eventTypes.id))
      .innerJoin(
        templateVersions,
        eq(templates.publishedVersionId, templateVersions.id),
      )
      .where(and(eq(templates.slug, slug), eq(templates.status, 'published')))
      .limit(1);

    if (!row) return null;

    const { createdAt: _createdAt, ...rest } = row;
    return rest;
  },
);

/** Slugovi svih objavljenih šablona - koristi ih sitemap i statička generacija. */
export const listTemplateSlugs = cache(async (): Promise<string[]> => {
  const rows = await db
    .select({ slug: templates.slug })
    .from(templates)
    .where(eq(templates.status, 'published'));

  return rows.map((row) => row.slug);
});

/** Šabloni dostupni u zadatim paketima; koristi ga čarobnjak. */
export async function listTemplatesForPlans(
  planCodes: readonly string[],
  eventTypeKey?: string,
): Promise<TemplateSummary[]> {
  const conditions: SQL[] = [
    eq(templates.status, 'published'),
    inArray(templates.requiredPlanCode, [...planCodes]),
  ];

  if (eventTypeKey) conditions.push(eq(eventTypes.key, eventTypeKey));

  const rows = await db
    .select(summarySelection)
    .from(templates)
    .innerJoin(eventTypes, eq(templates.eventTypeId, eventTypes.id))
    .innerJoin(templateVersions, eq(templates.publishedVersionId, templateVersions.id))
    .where(and(...conditions))
    .orderBy(desc(templates.isFeatured), asc(templates.sortOrder));

  return rows.map(({ createdAt: _createdAt, ...rest }) => rest);
}

/** Dostupni stilovi i boje za filtere; računa se iz stvarnog sadržaja baze. */
export const getTemplateFacets = cache(
  async (): Promise<{
    styles: Array<{ value: string; count: number }>;
    colorGroups: Array<{ value: string; count: number }>;
  }> => {
    const rows = await db
      .select({
        style: templates.style,
        dominantColor: templates.dominantColor,
        count: sql<number>`count(*)::int`,
      })
      .from(templates)
      .where(eq(templates.status, 'published'))
      .groupBy(templates.style, templates.dominantColor);

    const styles = new Map<string, number>();
    const colors = new Map<string, number>();

    for (const row of rows) {
      styles.set(row.style, (styles.get(row.style) ?? 0) + row.count);
      const group = colorGroupOf(row.dominantColor);
      colors.set(group, (colors.get(group) ?? 0) + row.count);
    }

    const toSorted = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return { styles: toSorted(styles), colorGroups: toSorted(colors) };
  },
);

export const COLOR_GROUPS = ['svetla', 'topla', 'hladna', 'tamna'] as const;
export type ColorGroup = (typeof COLOR_GROUPS)[number];

/**
 * Svrstava dominantnu boju šablona u jednu od četiri grupe.
 *
 * Korisnik ne bira „#fbf6f4" nego „svetla" ili „tamna"; grupisanje po
 * svetlini i nijansi je razumljivije od palete heks vrednosti (zahtev 7).
 */
export function colorGroupOf(hex: string): ColorGroup {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 'svetla';

  const value = Number.parseInt(match[1] as string, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  // Percepciona svetlina (ITU-R BT.601) - bolja od proseka kanala.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance < 0.35) return 'tamna';

  /*
   * Topla ako crveni kanal nadmašuje plavi, hladna u obrnutom slučaju.
   *
   * Prag je namerno nizak (4 od 255): pozadine šablona su vrlo svetle, a kod
   * takvih boja se razlika između kanala sabija. Praznično plava `#f4f8fb`
   * ima svega 7 razlike, a oku je jasno hladna - sa strožim pragom završila bi
   * među neutralnima. Boje bez ikakve hrome ostaju „svetla".
   */
  const warmth = r - b;
  if (warmth >= 4) return 'topla';
  if (warmth <= -4) return 'hladna';
  return 'svetla';
}
