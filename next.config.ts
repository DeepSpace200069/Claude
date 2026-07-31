import type { NextConfig } from 'next';

/**
 * Hostovi skladišta medija.
 *
 * Politika se širi **imenom hosta iz konfiguracije**, ne džokerom: kada je
 * skladište lokalno, spisak je prazan i pravilo ostaje na `'self'`.
 */
const imageHosts = (process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const mediaOrigins = imageHosts.map((host) => `https://${host}`);

/**
 * Content Security Policy (zahtev 24).
 *
 * Dve odluke koje treba razumeti pre menjanja:
 *
 * 1. **`script-src` sadrži `'unsafe-inline'`.** Next ubacuje inline skript sa
 *    RSC podacima u svaku stranicu. Uredno rešenje je nonce, ali nonce mora da
 *    se izračuna po zahtevu, što isključuje keširanje cele rute - a javna
 *    pozivnica se namerno kešira (zahtev 4.7). Umesto lažnog izbora između dva
 *    dobra, biramo keširanje i **uklanjamo razlog za XSS**: aplikacija nigde ne
 *    prikazuje korisnički HTML, svaki tekst se ispisuje kao tekst, a linkovi su
 *    ograničeni na `http`/`https` (`safeUrlSchema`).
 * 2. **`media-src` dozvoljava `https:`.** Muzička sekcija sme da pokaže na
 *    tuđi audio fajl, pa bi uže pravilo isključilo funkcionalnost koju
 *    uređivač nudi. Slike su uže: samo `'self'`, `data:`, `blob:` i hostovi
 *    skladišta.
 *
 * `frame-ancestors` ponavlja ono što kaže `X-Frame-Options`, jer stariji
 * pregledači razumeju samo drugo, a noviji samo prvo.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Teme se prenose kao inline CSS promenljive na korenu pozivnice.
  "style-src 'self' 'unsafe-inline'",
  ["img-src 'self' data: blob:", ...mediaOrigins].join(' '),
  ["connect-src 'self'", ...mediaOrigins].join(' '),
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    // Keeps the public invitation bundle small: only the icons actually used
    // are pulled in from the icon package.
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        /*
         * Personalizovani linkovi gostiju se nikad ne indeksiraju.
         *
         * Za `/p/:slug` **nema** ovakvog zaglavlja: režim privatnosti bira
         * organizator, pa odluku donosi `generateMetadata` te stranice. Kada bi
         * ovde stajalo bezuslovno `noindex`, opcija „javno" u interfejsu bi bila
         * obećanje koje aplikacija ne ispunjava.
         */
        source: '/p/:slug/:token*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
