import type { MetadataRoute } from 'next';

import { appUrl } from '@/config/brand';
import { listActiveEventTypes } from '@/server/services/catalog';
import { listTemplates } from '@/server/services/templates';

/**
 * Sitemap (zahtev 33).
 *
 * Sadrži **samo** marketinške stranice i javne šablone. Pozivnice korisnika
 * (`/p/...`), demo stranice i ceo `/app` namerno izostaju: to je privatan
 * sadržaj i ne sme da završi u indeksu pretraživača.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: appUrl('/sabloni'), lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: appUrl('/kako-funkcionise'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: appUrl('/cenovnik'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: appUrl('/cesta-pitanja'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: appUrl('/kontakt'), lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: appUrl('/uslovi-koriscenja'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: appUrl('/politika-privatnosti'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Ako baza nije dostupna, sitemap i dalje treba da se generiše sa statičkim
  // stranicama - prazan sitemap je gori od nepotpunog.
  try {
    const [eventTypes, templates] = await Promise.all([
      listActiveEventTypes(),
      listTemplates(),
    ]);

    return [
      ...staticPages,
      ...eventTypes.map((eventType) => ({
        url: appUrl(`/sabloni/${eventType.slug}`),
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...templates.map((template) => ({
        url: appUrl(`/sabloni/${template.eventTypeSlug}/${template.slug}`),
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.warn(
      '[sitemap] Baza nije dostupna, vraćam samo statičke stranice:',
      error instanceof Error ? error.message : error,
    );
    return staticPages;
  }
}
