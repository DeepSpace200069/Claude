import type { MediaResolution } from '@/features/sections/types';
import type { MediaAsset } from '@/server/services/media';

/**
 * Fotografije događaja u oblik koji renderer očekuje.
 *
 * Ista pretvorba postoji i u `server/services/media.ts`, ali taj modul je
 * `server-only` - uređivač ga ne sme uvesti u klijentski paket. Ovde je zato
 * čista funkcija bez ijedne serverske zavisnosti; tip `MediaAsset` se uvozi
 * samo kao tip, pa nestaje pri kompajliranju.
 */
export function mediaMapFromAssets(
  assets: readonly MediaAsset[],
): Record<string, MediaResolution> {
  const map: Record<string, MediaResolution> = {};

  for (const asset of assets) {
    map[asset.id] = {
      url: asset.url,
      alt: asset.altText,
      width: asset.width,
      height: asset.height,
      placeholder: asset.placeholder,
      focalX: asset.focalX,
      focalY: asset.focalY,
    };
  }

  return map;
}
