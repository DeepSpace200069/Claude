import type { MetadataRoute } from 'next';

import { appUrl } from '@/config/brand';

/**
 * robots.txt (zahtev 33).
 *
 * Marketing se indeksira, kontrolni panel i interne rute se ne obilaze.
 *
 * `/p/` namerno **nije** zabranjen. Podrazumevani režim pozivnice je
 * „neindeksirano", ali tu odluku nosi `noindex` u samoj stranici, a pretraživač
 * je vidi samo ako sme da stranicu poseti. Zabrana u `robots.txt` bi ga
 * sprečila da pročita `noindex`, pa bi URL mogao da završi u indeksu bez
 * sadržaja - suprotno od željenog. Organizator koji izabere režim „javno"
 * ovako zaista dobija pozivnicu u pretrazi, a svi ostali režimi šalju `noindex`.
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
          '/demo/', // demo šablona; kanonska je detaljna stranica šablona
          '/login',
        ],
      },
    ],
    sitemap: appUrl('/sitemap.xml'),
    host: appUrl('/'),
  };
}
