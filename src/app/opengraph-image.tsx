import { ImageResponse } from 'next/og';

import { brand } from '@/config/brand';

/**
 * Open Graph slika za marketing stranice (zahtev 16 i 33).
 *
 * Generiše se na serveru iz istih brend tokena kao i sam sajt, pa promena
 * brenda ne zahteva novu sliku u dizajn alatu. Koriste se samo sistemski
 * fontovi - bez preuzimanja font fajla nema ni dodatnog kašnjenja ni rizika da
 * generisanje padne kada font nije dostupan.
 */
export const runtime = 'nodejs';
export const alt = `${brand.name} — digitalne pozivnice`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          background: '#faf8f5',
          backgroundImage:
            'radial-gradient(60% 60% at 50% 0%, #f3e6ec 0%, transparent 70%)',
          color: '#2b2724',
          fontFamily: 'Georgia, serif',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#6d655e',
          }}
        >
          {brand.name}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 76,
            lineHeight: 1.1,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          Digitalne pozivnice koje se pamte
        </div>

        <div style={{ display: 'flex', width: 120, height: 2, background: '#7d3f57' }} />

        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: '#6d655e',
            textAlign: 'center',
            maxWidth: 820,
          }}
        >
          Venčanja · Krštenja · Rođendani · Punoletstva
        </div>
      </div>
    ),
    size,
  );
}
