import { NextResponse } from 'next/server';

import {
  MAX_UPLOAD_BYTES,
  getLocalStorageAdapter,
  validateUpload,
} from '@/server/adapters/storage';
import { detectImageFormat, stripImageMetadata } from '@/lib/image-metadata';

/**
 * Prijem fotografije u razvojnom režimu (`STORAGE_DRIVER=local`).
 *
 * Postoji da bi tok otpremanja bio **isti** kao u produkciji: klijent traži
 * potpisan URL pa šalje `PUT`. Ruta zato nije otvoreni endpoint - proverava
 * HMAC potpis i rok koje je izdao lokalni adapter, tako da bez prethodne
 * autorizovane akcije ovde ništa ne može da se upiše (zahtev 24).
 *
 * Pre upisa se iz bajtova uklanjaju metapodaci. Klijent to već radi
 * prekodiranjem kroz canvas, ali klijentska obrada nije odbrana - ovo je
 * serverska.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const adapter = getLocalStorageAdapter();

  if (!adapter) {
    return NextResponse.json(
      { error: 'Lokalno otpremanje nije aktivno.' },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const storageKey = url.searchParams.get('key');
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');

  if (!storageKey || !signature || !Number.isFinite(expires)) {
    return NextResponse.json({ error: 'Nepotpun zahtev.' }, { status: 400 });
  }

  if (!adapter.verify(storageKey, expires, signature)) {
    return NextResponse.json(
      { error: 'Potpis nije ispravan ili je istekao.' },
      { status: 403 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  const body = new Uint8Array(await request.arrayBuffer());

  const invalid = validateUpload({
    mimeType: contentType.split(';')[0]?.trim() ?? '',
    sizeBytes: body.byteLength,
  });
  if (invalid) {
    return NextResponse.json({ error: invalid.message }, { status: 400 });
  }

  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Fotografija je prevelika.' }, { status: 413 });
  }

  // Sadržaj mora da odgovara prijavljenom tipu: `Content-Type` je samo tvrdnja
  // klijenta, a potpis se izdaje za tip koji je akcija odobrila.
  const format = detectImageFormat(body);
  if (format === 'unknown') {
    return NextResponse.json(
      { error: 'Sadržaj nije fotografija u podržanom formatu.' },
      { status: 400 },
    );
  }

  const stripped = stripImageMetadata(body);

  await adapter.writeFile(storageKey, Buffer.from(stripped.bytes));

  return NextResponse.json({
    ok: true,
    removed: stripped.removed,
  });
}
