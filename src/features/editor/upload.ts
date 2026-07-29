'use client';

import { MAX_UPLOAD_BYTES } from '@/server/adapters/storage/types';
import {
  confirmUploadAction,
  requestUploadAction,
} from '@/server/actions/media';
import type { MediaAsset } from '@/server/services/media';

/**
 * Priprema i otpremanje fotografije iz uređivača (zahtev 24 i 32).
 *
 * Fotografija se **prekodira** pre slanja, i to iz dva razloga:
 *
 * 1. Prekodirana slika nema metapodatke. EXIF sa telefona nosi tačnu GPS
 *    lokaciju; crtanje u `canvas` i ponovno kodiranje ih ne prenosi, jer canvas
 *    fizički nema gde da ih zapiše. Server posle otpremanja i sam proveri da ih
 *    zaista nema - klijentska obrada nikad nije odbrana.
 * 2. Slika sa telefona ima 4000 piksela i nekoliko megabajta. Gost pozivnicu
 *    otvara mobilnim internetom, pa je smanjenje na razumnu širinu deo
 *    performansi javne stranice.
 *
 * Orijentacija se primenjuje iz EXIF-a (`imageOrientation: 'from-image'`) pre
 * nego što ga izgubimo - inače bi uspravne fotografije sa telefona završile
 * okrenute na bok.
 */

/** Duža stranica fotografije posle smanjenja. */
export const MAX_IMAGE_EDGE = 2400;

/** Širina sitne sličice koja stoji dok se prava fotografija učitava. */
const PLACEHOLDER_EDGE = 20;

export type PreparedImage = {
  blob: Blob;
  mimeType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
  placeholder: string | null;
};

export class ImagePrepareError extends Error {
  constructor(
    message: string,
    readonly reason: 'decode' | 'encode' | 'too_large',
  ) {
    super(message);
    this.name = 'ImagePrepareError';
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImagePrepareError(
      'Fotografija nije mogla da se pročita. Pokušajte sa JPG, PNG ili WebP fajlom.',
      'decode',
    );
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new ImagePrepareError('Obrada fotografije nije uspela.', 'encode');
    }
    context.drawImage(bitmap, 0, 0, width, height);

    const encoded = await encodeSmallEnough(canvas);
    const placeholder = makePlaceholder(bitmap, width, height);

    return { ...encoded, width, height, placeholder };
  } finally {
    bitmap.close();
  }
}

/**
 * Kodiranje uz postepeno spuštanje kvaliteta.
 *
 * Gornja granica veličine je pravilo servera; bolje je poslati istu sliku sa
 * nešto nižim kvalitetom nego odbiti korisnika sa porukom „fajl je prevelik".
 */
async function encodeSmallEnough(
  canvas: HTMLCanvasElement,
): Promise<{ blob: Blob; mimeType: 'image/webp' | 'image/jpeg' }> {
  const qualities = [0.86, 0.72, 0.6];

  for (const type of ['image/webp', 'image/jpeg'] as const) {
    for (const quality of qualities) {
      const blob = await toBlob(canvas, type, quality);
      // Neki pregledači na nepoznat tip tiho vrate PNG - proveravamo šta smo
      // stvarno dobili umesto da verujemo zahtevu.
      if (!blob || blob.type !== type) break;
      if (blob.size <= MAX_UPLOAD_BYTES) return { blob, mimeType: type };
    }
  }

  throw new ImagePrepareError(
    'Fotografija je i posle smanjenja prevelika. Pokušajte sa manjom slikom.',
    'too_large',
  );
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Sitna sličica u `data:` obliku - ide u bazu, ne u storage. */
function makePlaceholder(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): string | null {
  const canvas = document.createElement('canvas');
  const scale = PLACEHOLDER_EDGE / Math.max(width, height);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const url = canvas.toDataURL('image/webp', 0.5);
  return url.startsWith('data:image/') && url.length <= 4096 ? url : null;
}

export type UploadOutcome =
  | { ok: true; asset: MediaAsset }
  | { ok: false; message: string };

/**
 * Ceo tok otpremanja: priprema, karta sa servera, slanje u skladište, potvrda.
 *
 * Ako slanje u skladište ne uspe, zapis ostaje u stanju `pending` i nikad ne
 * stiže do pozivnice - prekinuto otpremanje zato ne ostavlja rupu u galeriji.
 */
export async function uploadImage(
  eventId: string,
  file: File,
  altText: string,
): Promise<UploadOutcome> {
  let prepared: PreparedImage;

  try {
    prepared = await prepareImage(file);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ImagePrepareError
          ? error.message
          : 'Fotografija nije mogla da se obradi.',
    };
  }

  const ticket = await requestUploadAction({
    eventId,
    mimeType: prepared.mimeType,
    sizeBytes: prepared.blob.size,
  });

  if (!ticket.ok) return { ok: false, message: ticket.message };

  const response = await fetch(ticket.data.uploadUrl, {
    method: ticket.data.method,
    headers: ticket.data.headers,
    body: prepared.blob,
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      ok: false,
      message: 'Slanje fotografije nije uspelo. Proverite vezu i pokušajte ponovo.',
    };
  }

  const confirmed = await confirmUploadAction({
    eventId,
    assetId: ticket.data.assetId,
    width: prepared.width,
    height: prepared.height,
    altText,
    placeholder: prepared.placeholder,
  });

  if (!confirmed.ok) return { ok: false, message: confirmed.message };

  return { ok: true, asset: confirmed.data };
}
