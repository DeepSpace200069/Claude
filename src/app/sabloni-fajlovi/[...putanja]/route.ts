import { NextResponse } from 'next/server';

import { contentTypeOf, templateAssetPrefix } from '@/lib/html-template/assets';
import { getStorageAdapter } from '@/server/adapters/storage';

/**
 * Fajlovi uvezenih HTML šablona (zahtev 39.3 i 39.4).
 *
 * Fajlovi se **ne** serviraju sa storage hosta nego kroz ovu rutu. Razlog je
 * politika sadržaja: `script-src 'self'` znači da skripta sa S3 domena ne bi
 * radila u produkciji, a radila bi u razvoju gde je storage lokalni folder -
 * greška koja se otkriva tek posle deploya.
 *
 * Sadržaj se **prenosi**, ne preusmerava: preusmerenje bi vratilo isti problem,
 * jer bi pregledač na kraju ipak povukao skriptu sa tuđeg domena.
 *
 * Ruta je javna, kao i sama pozivnica. Ono što servira je sadržaj šablona koji
 * je uvezao administrator - ne sadržaj korisnika i ne ništa lično. Adresa nosi
 * id **verzije** šablona, koja je nepromenljiva, pa se odgovor kešira zauvek.
 */

/** Godinu dana; verzija je nepromenljiva, nova verzija donosi nove adrese. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ putanja: string[] }> },
): Promise<NextResponse> {
  const { putanja } = await params;

  const versionId = putanja[0];
  const path = putanja.slice(1).map(decodeSegment).join('/');

  /*
   * Putanja se proverava, a ne samo sastavlja: `..` u segmentu bi izašao iz
   * prefiksa verzije i dohvatio tuđi objekat iz istog bucket-a.
   */
  if (!versionId || !isUuid(versionId) || path === '' || !isSafePath(path)) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = contentTypeOf(path);
  if (!contentType) return new NextResponse(null, { status: 404 });

  const bytes = await getStorageAdapter().readObject(
    `${templateAssetPrefix(versionId)}/${path}`,
  );

  if (!bytes) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': CACHE_CONTROL,
      'Content-Length': String(bytes.byteLength),
      // Fajl šablona nikad nije dokument koji pregledač treba da tumači kao naš.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isSafePath(path: string): boolean {
  if (path.length > 300) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
