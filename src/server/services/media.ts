import 'server-only';

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import { checkLimit } from '@/features/billing/entitlements';
import type { MediaResolution } from '@/features/sections/types';
import { hasImageMetadata } from '@/lib/image-metadata';
import { db } from '@/server/db';
import { mediaAssets } from '@/server/db/schema';
import {
  METADATA_SCAN_BYTES,
  getStorageAdapter,
  validateUpload,
  type UploadTicket,
} from '@/server/adapters/storage';
import { LimitExceededError, NotFoundError, ValidationError } from '@/server/authz/errors';

import { getEventEntitlements } from './entitlements';

/**
 * Fotografije pozivnice (zahtev 9 i 24).
 *
 * Tok je isti bez obzira na storage: server izda potpisan URL i odmah upiše
 * zapis u stanju `pending`, pregledač pošalje fajl direktno u storage, pa server
 * potvrdi zapis. Zapis u stanju `pending` nikad ne stiže do pozivnice, tako da
 * prekinuto otpremanje ne ostavlja rupu u galeriji.
 */

export type MediaAsset = {
  id: string;
  url: string;
  altText: string;
  width: number | null;
  height: number | null;
  placeholder: string | null;
  focalX: number;
  focalY: number;
  sizeBytes: number;
  createdAt: Date;
};

/** Sitna sličica za početno stanje; strogo ograničena da ne postane vektor. */
const PLACEHOLDER_PATTERN = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
const PLACEHOLDER_MAX_LENGTH = 4096;

export function isValidPlaceholder(value: string): boolean {
  return value.length <= PLACEHOLDER_MAX_LENGTH && PLACEHOLDER_PATTERN.test(value);
}

export async function countEventPhotos(eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.eventId, eventId),
        eq(mediaAssets.status, 'ready'),
        isNull(mediaAssets.deletedAt),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Izdavanje karte za otpremanje.
 *
 * Limit paketa se proverava **ovde**, a ne u interfejsu: sakriveno dugme nije
 * odbrana (zahtev 24 i 39.9).
 */
export async function requestUpload(input: {
  userId: string;
  eventId: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ assetId: string; ticket: UploadTicket }> {
  const invalid = validateUpload(input);
  if (invalid) {
    throw new ValidationError(invalid.message, { file: [invalid.message] });
  }

  const entitlements = await getEventEntitlements(input.eventId);
  const used = await countEventPhotos(input.eventId);
  const limit = checkLimit(entitlements, 'maxPhotos', used);

  if (!limit.allowed) {
    throw new LimitExceededError(
      `Vaš paket dozvoljava najviše ${limit.limit} fotografija po događaju.`,
      { limit: limit.limit, current: limit.current, feature: 'maxPhotos' },
    );
  }

  const storage = getStorageAdapter();
  const ticket = await storage.createUploadTicket({
    prefix: `events/${input.eventId}`,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      ownerId: input.userId,
      eventId: input.eventId,
      storageKey: ticket.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: 'pending',
    })
    .returning({ id: mediaAssets.id });

  if (!asset) throw new Error('Zapis o fotografiji nije napravljen.');

  return { assetId: asset.id, ticket };
}

export type ConfirmUploadInput = {
  assetId: string;
  eventId: string;
  width: number;
  height: number;
  altText: string;
  placeholder: string | null;
};

/**
 * Potvrda otpremanja uz proveru da u fajlu nema metapodataka.
 *
 * Uređivač uklanja EXIF pre slanja (prekodiranje kroz canvas), ali klijentska
 * obrada nije odbrana. Zato server pročita početne bajtove iz storage-a i sam
 * proveri: ako metapodaci ipak postoje, fotografija se briše i ne ulazi u
 * pozivnicu (zahtev 24).
 */
export async function confirmUpload(
  input: ConfirmUploadInput,
): Promise<MediaAsset> {
  const [asset] = await db
    .select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      status: mediaAssets.status,
      sizeBytes: mediaAssets.sizeBytes,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, input.assetId),
        eq(mediaAssets.eventId, input.eventId),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!asset) throw new NotFoundError('Fotografija ne postoji.');

  if (input.placeholder && !isValidPlaceholder(input.placeholder)) {
    throw new ValidationError('Sličica za pregled nije u očekivanom obliku.', {
      placeholder: ['Neispravna sličica.'],
    });
  }

  const storage = getStorageAdapter();
  const head = await storage.readHead(asset.storageKey, METADATA_SCAN_BYTES);

  if (!head || head.length === 0) {
    await markFailed(asset.id);
    throw new ValidationError('Otpremanje fotografije nije završeno.', {
      file: ['Fajl nije stigao u skladište. Pokušajte ponovo.'],
    });
  }

  if (hasImageMetadata(head)) {
    // Fajl sa zaostalim EXIF-om ne ostaje da leži u skladištu.
    await storage.delete(asset.storageKey).catch(() => undefined);
    await markFailed(asset.id);
    throw new ValidationError(
      'Fotografija još sadrži skrivene podatke (npr. lokaciju) i zato nije prihvaćena.',
      { file: ['Pokušajte ponovo iz uređivača.'] },
    );
  }

  const [updated] = await db
    .update(mediaAssets)
    .set({
      status: 'ready',
      width: Math.round(input.width) || null,
      height: Math.round(input.height) || null,
      altText: input.altText.trim().slice(0, 180),
      placeholder: input.placeholder,
    })
    .where(eq(mediaAssets.id, asset.id))
    .returning({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
      placeholder: mediaAssets.placeholder,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
      sizeBytes: mediaAssets.sizeBytes,
      createdAt: mediaAssets.createdAt,
    });

  if (!updated) throw new Error('Fotografija nije potvrđena.');

  return toMediaAsset(updated);
}

async function markFailed(assetId: string): Promise<void> {
  await db
    .update(mediaAssets)
    .set({ status: 'failed' })
    .where(eq(mediaAssets.id, assetId));
}

export async function listEventMedia(eventId: string): Promise<MediaAsset[]> {
  const rows = await db
    .select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
      placeholder: mediaAssets.placeholder,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
      sizeBytes: mediaAssets.sizeBytes,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.eventId, eventId),
        eq(mediaAssets.status, 'ready'),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(mediaAssets.createdAt));

  return rows.map(toMediaAsset);
}

/** Fotografije koje konkretne sekcije traže - koristi ih javni prikaz. */
export async function resolveMediaByIds(
  assetIds: readonly string[],
): Promise<Record<string, MediaResolution>> {
  if (assetIds.length === 0) return {};

  const rows = await db
    .select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
      placeholder: mediaAssets.placeholder,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
    })
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.id, [...new Set(assetIds)]),
        eq(mediaAssets.status, 'ready'),
        isNull(mediaAssets.deletedAt),
      ),
    );

  const storage = getStorageAdapter();
  const result: Record<string, MediaResolution> = {};

  for (const row of rows) {
    result[row.id] = {
      url: storage.getPublicUrl(row.storageKey),
      alt: row.altText ?? '',
      width: row.width,
      height: row.height,
      placeholder: row.placeholder,
      focalX: row.focalX,
      focalY: row.focalY,
    };
  }

  return result;
}

export function mediaMapFrom(
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

/**
 * Brisanje fotografije.
 *
 * Zapis se meko briše, a fajl se uklanja iz skladišta odmah: korisnik koji je
 * greškom otpremio tuđu ili privatnu fotografiju očekuje da nestane sa javnog
 * URL-a istog trenutka, a ne po isteku retencije.
 */
export async function deleteMedia(assetId: string, eventId: string): Promise<void> {
  const [asset] = await db
    .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.eventId, eventId),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .limit(1);

  if (!asset) throw new NotFoundError('Fotografija ne postoji.');

  await getStorageAdapter().delete(asset.storageKey).catch(() => undefined);

  await db
    .update(mediaAssets)
    .set({ deletedAt: new Date(), status: 'failed' })
    .where(eq(mediaAssets.id, asset.id));
}

export async function updateMediaAlt(
  assetId: string,
  eventId: string,
  altText: string,
): Promise<void> {
  await db
    .update(mediaAssets)
    .set({ altText: altText.trim().slice(0, 180) })
    .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.eventId, eventId)));
}

function toMediaAsset(row: {
  id: string;
  storageKey: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  placeholder: string | null;
  focalX: number;
  focalY: number;
  sizeBytes: number;
  createdAt: Date;
}): MediaAsset {
  return {
    id: row.id,
    url: getStorageAdapter().getPublicUrl(row.storageKey),
    altText: row.altText ?? '',
    width: row.width,
    height: row.height,
    placeholder: row.placeholder,
    focalX: row.focalX,
    focalY: row.focalY,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}
