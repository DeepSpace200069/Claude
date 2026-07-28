import type { MetadataRoute } from 'next';

import { appUrl } from '@/config/brand';

/**
 * robots.txt (zahtev 33).
 *
 * Marketing se indeksira, sve privatno se izričito isključuje. Ovo je druga
 * linija odbrane: javne pozivnice već šalju `X-Robots-Tag: noindex` zaglavlje
 * (vidi `next.config.ts`), jer `robots.txt` sprečava obilazak, ali sam po sebi
 * ne garantuje da URL neće završiti u indeksu.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app/', // kontrolni panel organizatora
          '/api/', // interne rute
          '/p/', // javne pozivnice - privatan sadržaj gostiju
          '/demo/', // demo šablona; kanonska je detaljna stranica šablona
          '/login',
        ],
      },
    ],
    sitemap: appUrl('/sitemap.xml'),
    host: appUrl('/'),
  };
}
