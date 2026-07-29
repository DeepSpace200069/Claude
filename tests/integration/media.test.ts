import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { db } from '@/server/db';
import { featurePlans, mediaAssets } from '@/server/db/schema';
import { LimitExceededError, ValidationError } from '@/server/authz/errors';
import {
  setStorageAdapter,
  type StorageAdapter,
  type UploadRequest,
  type UploadTicket,
} from '@/server/adapters/storage';
import { createEvent } from '@/server/services/events';
import {
  confirmUpload,
  countEventPhotos,
  deleteMedia,
  isValidPlaceholder,
  listEventMedia,
  requestUpload,
  resolveMediaByIds,
} from '@/server/services/media';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Otpremanje fotografija (zahtev 24).
 *
 * Storage se zamenjuje lažnim adapterom da bi test mogao da kontroliše šta je
 * „stiglo" u skladište. To je i suština provere: server posle otpremanja čita
 * početne bajtove i sam odlučuje da li fotografija sme u pozivnicu.
 */
class FakeStorage implements StorageAdapter {
  readonly name = 'fake';
  readonly files = new Map<string, Uint8Array>();
  readonly deleted: string[] = [];
  private counter = 0;

  async createUploadTicket(request: UploadRequest): Promise<UploadTicket> {
    this.counter += 1;
    const storageKey = `${request.prefix}/fajl-${this.counter}.webp`;
    return {
      storageKey,
      uploadUrl: `https://primer.test/${storageKey}`,
      method: 'PUT',
      headers: { 'Content-Type': request.mimeType },
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  getPublicUrl(storageKey: string): string {
    return `https://cdn.primer.test/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    this.deleted.push(storageKey);
    this.files.delete(storageKey);
  }

  async readHead(storageKey: string, length: number): Promise<Uint8Array | null> {
    const file = this.files.get(storageKey);
    return file ? file.subarray(0, length) : null;
  }
}

/** Minimalan WebP bez metapodataka. */
function cleanWebp(): Uint8Array {
  return webp(0, false);
}

/** WebP koji u VP8X zaglavlju prijavljuje EXIF blok. */
function webpWithExif(): Uint8Array {
  return webp(0x08, true);
}

function webp(flags: number, withExifChunk: boolean): Uint8Array {
  const parts: number[] = [];
  const push = (text: string) => {
    for (const char of text) parts.push(char.charCodeAt(0));
  };
  const pushSize = (size: number) => {
    parts.push(size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff);
  };

  const payload: number[] = [];
  const pushPayload = (text: string) => {
    for (const char of text) payload.push(char.charCodeAt(0));
  };

  pushPayload('WEBP');
  pushPayload('VP8X');
  payload.push(10, 0, 0, 0, flags, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  pushPayload('VP8 ');
  payload.push(4, 0, 0, 0, 1, 2, 3, 4);

  if (withExifChunk) {
    pushPayload('EXIF');
    payload.push(8, 0, 0, 0, 0x49, 0x49, 42, 0, 8, 0, 0, 0);
  }

  push('RIFF');
  pushSize(payload.length);
  parts.push(...payload);

  return new Uint8Array(parts);
}

describe.skipIf(!hasTestDatabase)('fotografije pozivnice', () => {
  let storage: FakeStorage;
  let userId: string;
  let eventId: string;

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);

    storage = new FakeStorage();
    setStorageAdapter(storage);

    const user = await createTestUser();
    userId = user.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Događaj sa slikama',
      details: {},
      date: '',
      time: '',
      timeZone: 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    eventId = created.eventId;
  });

  afterEach(() => {
    setStorageAdapter(null);
  });

  const upload = async (bytes: Uint8Array) => {
    const { assetId, ticket } = await requestUpload({
      userId,
      eventId,
      mimeType: 'image/webp',
      sizeBytes: bytes.byteLength,
    });

    storage.files.set(ticket.storageKey, bytes);
    return { assetId, storageKey: ticket.storageKey };
  };

  it('izdata karta pravi zapis u stanju čekanja, koji se ne prikazuje', async () => {
    const { assetId } = await upload(cleanWebp());

    const [row] = await db
      .select({ status: mediaAssets.status })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId));

    expect(row?.status).toBe('pending');
    // Prekinuto otpremanje ne sme da ostavi rupu u galeriji.
    expect(await listEventMedia(eventId)).toEqual([]);
    expect(await countEventPhotos(eventId)).toBe(0);
  });

  it('potvrda prihvata čistu fotografiju i vraća javni URL', async () => {
    const { assetId, storageKey } = await upload(cleanWebp());

    const asset = await confirmUpload({
      assetId,
      eventId,
      width: 1200,
      height: 800,
      altText: 'Mladenci ispred crkve',
      placeholder: 'data:image/webp;base64,AAAA',
    });

    expect(asset.url).toBe(`https://cdn.primer.test/${storageKey}`);
    expect(asset.altText).toBe('Mladenci ispred crkve');
    expect(asset.width).toBe(1200);
    expect(await countEventPhotos(eventId)).toBe(1);
  });

  it('odbija fotografiju sa zaostalim EXIF-om i briše je iz skladišta', async () => {
    const { assetId, storageKey } = await upload(webpWithExif());

    await expect(
      confirmUpload({
        assetId,
        eventId,
        width: 800,
        height: 600,
        altText: '',
        placeholder: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(storage.deleted).toContain(storageKey);

    const [row] = await db
      .select({ status: mediaAssets.status })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId));

    expect(row?.status).toBe('failed');
    expect(await listEventMedia(eventId)).toEqual([]);
  });

  it('odbija potvrdu kada fajl uopšte nije stigao u skladište', async () => {
    const { assetId } = await requestUpload({
      userId,
      eventId,
      mimeType: 'image/webp',
      sizeBytes: 1000,
    });

    await expect(
      confirmUpload({
        assetId,
        eventId,
        width: 100,
        height: 100,
        altText: '',
        placeholder: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('odbija sličicu koja nije bezbedna `data:` slika', async () => {
    const { assetId } = await upload(cleanWebp());

    await expect(
      confirmUpload({
        assetId,
        eventId,
        width: 100,
        height: 100,
        altText: '',
        placeholder: 'javascript:alert(1)',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('fotografija drugog događaja nije dostupna za potvrdu', async () => {
    const { assetId } = await upload(cleanWebp());

    await expect(
      confirmUpload({
        assetId,
        eventId: '11111111-2222-4333-8444-555555555555',
        width: 100,
        height: 100,
        altText: '',
        placeholder: null,
      }),
    ).rejects.toThrow();
  });

  it('odbija format koji ne primamo', async () => {
    await expect(
      requestUpload({
        userId,
        eventId,
        mimeType: 'image/avif',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('poštuje limit fotografija iz paketa', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          limits: { ...DEFAULT_PLANS.free.limits, maxPhotos: 1 },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    const first = await upload(cleanWebp());
    await confirmUpload({
      assetId: first.assetId,
      eventId,
      width: 100,
      height: 100,
      altText: '',
      placeholder: null,
    });

    await expect(
      requestUpload({ userId, eventId, mimeType: 'image/webp', sizeBytes: 500 }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });

  it('brisanje uklanja fajl iz skladišta odmah', async () => {
    const { assetId, storageKey } = await upload(cleanWebp());
    await confirmUpload({
      assetId,
      eventId,
      width: 100,
      height: 100,
      altText: '',
      placeholder: null,
    });

    await deleteMedia(assetId, eventId);

    expect(storage.deleted).toContain(storageKey);
    expect(await listEventMedia(eventId)).toEqual([]);
  });

  it('razrešavanje po identifikatorima vraća samo potvrđene fotografije', async () => {
    const ready = await upload(cleanWebp());
    await confirmUpload({
      assetId: ready.assetId,
      eventId,
      width: 640,
      height: 480,
      altText: 'Opis',
      placeholder: null,
    });

    const pending = await upload(cleanWebp());

    const resolved = await resolveMediaByIds([ready.assetId, pending.assetId]);

    expect(Object.keys(resolved)).toEqual([ready.assetId]);
    expect(resolved[ready.assetId]?.alt).toBe('Opis');
  });
});

describe('provera sličice', () => {
  it('prihvata samo `data:` slike razumne dužine', () => {
    expect(isValidPlaceholder('data:image/webp;base64,AAAA')).toBe(true);
    expect(isValidPlaceholder('data:image/png;base64,AAAA==')).toBe(true);
    expect(isValidPlaceholder('data:text/html;base64,AAAA')).toBe(false);
    expect(isValidPlaceholder('https://primer.test/slika.png')).toBe(false);
    expect(isValidPlaceholder(`data:image/webp;base64,${'A'.repeat(5000)}`)).toBe(false);
  });
});
