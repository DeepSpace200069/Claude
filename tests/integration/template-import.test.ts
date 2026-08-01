import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { templateAssetStorageKey } from '@/lib/html-template/assets';
import {
  setStorageAdapter,
  type StorageAdapter,
  type UploadRequest,
  type UploadTicket,
} from '@/server/adapters/storage';
import { db } from '@/server/db';
import { templateVersions, templates } from '@/server/db/schema';
import { buildTemplate, type BuiltTemplate } from '@/server/import/build';
import { readSiteFiles } from '@/server/import/files';
import { parseManifest, type ImportManifest } from '@/server/import/manifest';
import { assetUrlFor, newVersionId, saveTemplate } from '@/server/import/persist';
import { vendorResources } from '@/server/import/vendor';

import { hasTestDatabase, seedCatalog, truncateAll } from './helpers';

/**
 * Upis uvezenog HTML šablona (zahtev 39.3).
 *
 * Suština je idempotentnost: uvoz se u praksi pokreće više puta dok se
 * `template.json` ne doradi. Drugo pokretanje ne sme da napravi drugi šablon,
 * ni da ostavi fajlove prethodnog pokušaja u skladištu, ni - a to je najvažnije
 * - da dirne objavljenu verziju na kojoj vise tuđe pozivnice.
 */
const FIXTURE = path.join(process.cwd(), 'tests/fixtures/sajt-proba');

class FakeStorage implements StorageAdapter {
  readonly name = 'fake';
  readonly files = new Map<string, Uint8Array>();

  async createUploadTicket(request: UploadRequest): Promise<UploadTicket> {
    return {
      storageKey: `${request.prefix}/fajl.webp`,
      uploadUrl: 'https://primer.test/upload',
      method: 'PUT',
      headers: {},
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  getPublicUrl(storageKey: string): string {
    return `https://cdn.primer.test/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
  }

  async readHead(storageKey: string, length: number): Promise<Uint8Array | null> {
    return this.files.get(storageKey)?.subarray(0, length) ?? null;
  }

  async putObject(storageKey: string, data: Uint8Array): Promise<void> {
    this.files.set(storageKey, data);
  }

  async readObject(storageKey: string): Promise<Uint8Array | null> {
    return this.files.get(storageKey) ?? null;
  }
}

const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith('https://cdn.primer.test/')) {
    return new Response('window.animacije = function () {};');
  }
  if (url.startsWith('https://fonts.googleapis.com/')) {
    return new Response("@font-face{src:url('https://fonts.gstatic.test/probni.woff2')}");
  }
  return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]));
}) as typeof fetch;

let storage: FakeStorage;
let manifest: ImportManifest;

async function importFixture(): Promise<{ built: BuiltTemplate; versionId: string }> {
  const files = await readSiteFiles(FIXTURE);
  const vendored = await vendorResources({
    cacheRoot: null,
    files,
    vendor: manifest.vendor,
    fetchImpl: fakeFetch,
  });

  const versionId = newVersionId();
  const built = buildTemplate({
    manifest: { ...manifest, vendor: vendored.vendor },
    files: vendored.files,
    assetUrl: assetUrlFor(versionId),
  });

  await saveTemplate({ manifest, built, versionId });
  return { built, versionId };
}

describe.skipIf(!hasTestDatabase)('uvoz HTML šablona u bazu', () => {
  beforeEach(async () => {
    await truncateAll();
    await seedCatalog();
    storage = new FakeStorage();
    setStorageAdapter(storage);
    manifest = parseManifest(
      JSON.parse(await readFile(path.join(FIXTURE, 'template.json'), 'utf8')) as unknown,
    );
  });

  afterEach(() => {
    setStorageAdapter(null);
  });

  it('pravi radnu verziju HTML šablona sa poljima i fajlovima', async () => {
    const { built, versionId } = await importFixture();

    const template = await db.query.templates.findFirst({
      where: eq(templates.slug, manifest.slug),
    });

    expect(template?.kind).toBe('html');
    // Uvoz nikad ne objavljuje: šablon se objavljuje iz admin panela, svesno.
    expect(template?.status).toBe('draft');
    expect(template?.publishedVersionId).toBeNull();

    const version = await db.query.templateVersions.findFirst({
      where: eq(templateVersions.id, versionId),
    });

    expect(version?.version).toBe(1);
    expect(version?.htmlDocument).toContain('{{text:imena}}');
    expect(version?.fieldDefinitions?.fields).toHaveLength(
      built.fieldDefinitions.fields.length,
    );
    // Sekcije ostaju prazne - HTML šablon ih nema, a kolona je zajednička.
    expect(version?.sections).toEqual([]);
  });

  it('fajlovi šablona zaista završe u skladištu, pod adresom iz dokumenta', async () => {
    const { built, versionId } = await importFixture();

    for (const asset of built.assets) {
      expect(storage.files.has(templateAssetStorageKey(versionId, asset.path))).toBe(true);
    }

    const css = storage.files.get(templateAssetStorageKey(versionId, 'css/stil.css'));
    expect(new TextDecoder().decode(css)).toContain(`/sabloni-fajlovi/${versionId}/img/`);
  });

  it('ponovni uvoz menja istu radnu verziju, ne pravi drugi šablon', async () => {
    const first = await importFixture();
    const second = await importFixture();

    const all = await db.query.templates.findMany({
      where: eq(templates.slug, manifest.slug),
    });
    expect(all).toHaveLength(1);

    const versions = await db.query.templateVersions.findMany({
      where: eq(templateVersions.templateId, all[0]!.id),
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]?.id).toBe(second.versionId);
    expect(versions[0]?.version).toBe(1);

    // Fajlovi prethodnog pokušaja se brišu; skladište ne skuplja smeće.
    for (const asset of first.built.assets) {
      expect(storage.files.has(templateAssetStorageKey(first.versionId, asset.path))).toBe(
        false,
      );
    }
  });

  it('objavljena verzija se ne dira - na njoj vise već napravljene pozivnice', async () => {
    const first = await importFixture();

    await db
      .update(templateVersions)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(templateVersions.id, first.versionId));

    const second = await importFixture();

    const versions = await db.query.templateVersions.findMany({
      where: eq(templateVersions.templateId, (await currentTemplate()).id),
    });

    expect(versions).toHaveLength(2);
    expect(versions.find((row) => row.id === first.versionId)?.status).toBe('published');
    expect(versions.find((row) => row.id === second.versionId)?.version).toBe(2);
  });

  it('ne prepisuje šablon od sekcija koji nosi isti slug', async () => {
    await importFixture();
    await db
      .update(templates)
      .set({ kind: 'sections' })
      .where(eq(templates.slug, manifest.slug));

    await expect(importFixture()).rejects.toThrow(/nije HTML šablon/);
  });

  it('nepostojeći tip događaja se prijavljuje, a ništa se ne upisuje', async () => {
    manifest = { ...manifest, eventType: 'nepostojeci-tip' };

    await expect(importFixture()).rejects.toThrow(/Tip događaja/);

    const all = await db.query.templates.findMany();
    expect(all).toHaveLength(0);
  });
});

async function currentTemplate(): Promise<{ id: string }> {
  const template = await db.query.templates.findFirst({
    where: eq(templates.slug, manifest.slug),
  });
  if (!template) throw new Error('Šablon nije nađen.');
  return template;
}
