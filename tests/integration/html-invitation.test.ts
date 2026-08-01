import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultThemeTokens } from '@/features/themes/tokens';
import {
  setStorageAdapter,
  type StorageAdapter,
  type UploadRequest,
  type UploadTicket,
} from '@/server/adapters/storage';
import { ConflictError, ValidationError } from '@/server/authz/errors';
import { db } from '@/server/db';
import {
  invitationSections,
  invitations,
  templateVersions,
  templates,
} from '@/server/db/schema';
import { buildTemplate } from '@/server/import/build';
import { readSiteFiles } from '@/server/import/files';
import { parseManifest, type ImportManifest } from '@/server/import/manifest';
import { assetUrlFor, newVersionId, saveTemplate } from '@/server/import/persist';
import { vendorResources } from '@/server/import/vendor';
import { createEvent } from '@/server/services/events';
import { loadTemplateVersionPreview } from '@/server/services/template-preview';
import {
  getInvitationForEditor,
  loadRevisionFieldValues,
  listInvitationRevisions,
  saveInvitationFields,
  switchInvitationHtmlTemplate,
  switchInvitationTemplate,
} from '@/server/services/invitations';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Pozivnica napravljena od uvezenog sajta, serverska strana (zahtev 39.4).
 *
 * Sve se vrti oko jednog pravila: pozivnica nosi **svoj snimak** definicija
 * polja. Kasnija izmena šablona zato ne može da učini već unete vrednosti
 * neispravnim, a promena šablona ne sme da ostavi pozivnicu sa novim
 * definicijama i starim vrednostima.
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
  if (url.startsWith('https://fonts.googleapis.com/')) {
    return new Response("@font-face{src:url('https://fonts.gstatic.test/probni.woff2')}");
  }
  if (url.startsWith('https://cdn.primer.test/')) return new Response('window.a = 1;');
  return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]));
}) as typeof fetch;

/** Uveze uzorak; šablon ostaje radna verzija, kao posle pravog uvoza. */
async function importDraftTemplate(
  overrides: Partial<ImportManifest> = {},
): Promise<{ templateId: string; versionId: string }> {
  const files = await readSiteFiles(FIXTURE);
  const base = parseManifest(
    JSON.parse(await readFile(path.join(FIXTURE, 'template.json'), 'utf8')) as unknown,
  );
  const manifest = { ...base, ...overrides };

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

  const saved = await saveTemplate({ manifest, built, versionId });
  return { templateId: saved.templateId, versionId };
}

/** Uveze uzorak i objavi ga - kreiranje pozivnice traži objavljenu verziju. */
async function importPublishedTemplate(
  overrides: Partial<ImportManifest> = {},
): Promise<{ templateId: string; versionId: string }> {
  const imported = await importDraftTemplate(overrides);

  await db
    .update(templateVersions)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(templateVersions.id, imported.versionId));
  await db
    .update(templates)
    .set({ status: 'published', publishedVersionId: imported.versionId })
    .where(eq(templates.id, imported.templateId));

  return imported;
}

/**
 * Učitavanje pozivnice uz tvrdnju da je HTML.
 *
 * Bez ovoga bi svaki test ponavljao istu proveru tipa; ovako se u samom testu
 * vidi samo ono što se proverava.
 */
async function loadHtmlInvitation(eventId: string) {
  const invitation = await getInvitationForEditor(eventId);
  if (!invitation || invitation.html?.status !== 'ok') {
    throw new Error('Očekivana je HTML pozivnica.');
  }
  return { invitation, html: invitation.html };
}

describe.skipIf(!hasTestDatabase)('HTML pozivnica', () => {
  let weddingTypeId: string;
  let userId: string;
  let eventId: string;
  let templateId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
    setStorageAdapter(new FakeStorage());

    const user = await createTestUser();
    userId = user.id;

    ({ templateId } = await importPublishedTemplate());

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Ana i Marko',
      details: {},
      date: '2027-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
      templateId,
    });

    eventId = created.eventId;
  });

  it('nova pozivnica kopira definicije polja i podrazumevane vrednosti', async () => {
    const invitation = await getInvitationForEditor(eventId);

    expect(invitation?.html?.status).toBe('ok');
    if (invitation?.html?.status !== 'ok') throw new Error('Nije HTML pozivnica.');

    // Kopija, a ne referenca: kasnija izmena šablona ne dira ovu pozivnicu.
    expect(invitation.html.definitions.fields.map((field) => field.key)).toContain(
      'imena',
    );
    expect(invitation.html.values.imena).toBe('Ana i Marko');
    expect(invitation.html.document).toContain('{{text:imena}}');

    // HTML pozivnica nema sekcije - kolona ostaje prazna, ne poluprazna.
    const sections = await db
      .select()
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, invitation.invitationId));
    expect(sections).toHaveLength(0);
  });

  it('čuvanje menja vrednosti i podiže reviziju', async () => {
    const { invitation, html } = await loadHtmlInvitation(eventId);

    const saved = await saveInvitationFields({
      eventId,
      userId,
      baseRevision: invitation.revision,
      values: { ...html.values, imena: 'Milica i Stefan' },
    });

    expect(saved.revision).toBe(invitation.revision + 1);

    const after = await loadHtmlInvitation(eventId);
    expect(after.html.values.imena).toBe('Milica i Stefan');
  });

  it('obavezno polje ne sme da ostane prazno', async () => {
    const { invitation } = await loadHtmlInvitation(eventId);

    await expect(
      saveInvitationFields({
        eventId,
        userId,
        baseRevision: invitation.revision,
        values: { imena: '   ', datum: '2027-09-12' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('nepoznat ključ se odbacuje, a ne upisuje', async () => {
    const { invitation, html } = await loadHtmlInvitation(eventId);

    await saveInvitationFields({
      eventId,
      userId,
      baseRevision: invitation.revision,
      values: { ...html.values, staroPolje: 'nešto' },
    });

    const [row] = await db
      .select({ fieldValues: invitations.fieldValues })
      .from(invitations)
      .where(eq(invitations.eventId, eventId));

    expect(row?.fieldValues).not.toHaveProperty('staroPolje');
  });

  it('izmena zasnovana na staroj reviziji se odbija', async () => {
    const { invitation, html } = await loadHtmlInvitation(eventId);

    await saveInvitationFields({
      eventId,
      userId,
      baseRevision: invitation.revision,
      values: html.values,
    });

    await expect(
      saveInvitationFields({
        eventId,
        userId,
        baseRevision: invitation.revision,
        values: html.values,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('snimak revizije nosi vrednosti polja', async () => {
    const { invitation, html } = await loadHtmlInvitation(eventId);

    await saveInvitationFields({
      eventId,
      userId,
      baseRevision: invitation.revision,
      values: { ...html.values, imena: 'Sara i Vuk' },
    });

    const revisions = await listInvitationRevisions(invitation.invitationId);
    expect(revisions.length).toBeGreaterThan(0);

    const restored = await loadRevisionFieldValues(
      invitation.invitationId,
      revisions[0]!.id,
    );
    expect(restored.imena).toBe('Sara i Vuk');
  });

  it('promena šablona zadržava vrednosti polja koja i novi šablon ima', async () => {
    const { invitation, html } = await loadHtmlInvitation(eventId);
    const values = html.values;

    const saved = await saveInvitationFields({
      eventId,
      userId,
      baseRevision: invitation.revision,
      values: { ...values, imena: 'Sara i Vuk' },
    });

    const second = await importPublishedTemplate({
      slug: 'proba-vencanje-dva',
      name: 'Drugi probni sajt',
    });

    const result = await switchInvitationHtmlTemplate({
      eventId,
      userId,
      baseRevision: saved.revision,
      templateId: second.templateId,
      values: { ...values, imena: 'Sara i Vuk' },
    });

    expect(result.values.imena).toBe('Sara i Vuk');

    const [row] = await db
      .select({ templateVersionId: invitations.templateVersionId })
      .from(invitations)
      .where(eq(invitations.eventId, eventId));
    expect(row?.templateVersionId).toBe(second.versionId);
  });

  it('HTML pozivnica ne može da pređe na šablon od sekcija', async () => {
    const [sectionsTemplate] = await db
      .insert(templates)
      .values({
        slug: 'obican-sablon',
        name: 'Običan šablon',
        eventTypeId: weddingTypeId,
        kind: 'sections',
        status: 'published',
      })
      .returning({ id: templates.id });

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: sectionsTemplate!.id,
        version: 1,
        status: 'published',
        themeTokens: defaultThemeTokens,
        sections: [],
      })
      .returning({ id: templateVersions.id });

    await db
      .update(templates)
      .set({ publishedVersionId: version!.id })
      .where(eq(templates.id, sectionsTemplate!.id));

    const { invitation } = await loadHtmlInvitation(eventId);

    // Sadržaj nema zajednički oblik, pa bi prelazak bio tiho brisanje svega.
    await expect(
      switchInvitationHtmlTemplate({
        eventId,
        userId,
        baseRevision: invitation.revision,
        templateId: sectionsTemplate!.id,
        values: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('pozivnica od sekcija ne može da pređe na HTML šablon', async () => {
    const other = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Pozivnica od sekcija',
      details: {},
      date: '2027-10-01',
      time: '18:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: '',
      primaryLocale: 'sr-Latn',
    });

    const invitation = await getInvitationForEditor(other.eventId);

    await expect(
      switchInvitationTemplate({
        eventId: other.eventId,
        userId,
        baseRevision: invitation!.revision,
        templateId,
        document: invitation!.document,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe.skipIf(!hasTestDatabase)('pregled nacrta šablona', () => {
  let weddingTypeId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    setStorageAdapter(new FakeStorage());
  });

  it('vraća dokument verzije, bez obzira na status šablona', async () => {
    // Smisao pregleda je da administrator vidi **neobjavljen** šablon; da čita
    // samo objavljene, ne bi imao šta da pregleda pre objavljivanja.
    const { versionId } = await importDraftTemplate();
    const preview = await loadTemplateVersionPreview(versionId);

    expect(preview?.status).toBe('draft');
    expect(preview?.document).toContain('{{text:imena}}');
    expect(preview?.definitions.fields.length).toBeGreaterThan(0);
  });

  it('verzija šablona od sekcija nema šta da prikaže', async () => {
    const [template] = await db
      .insert(templates)
      .values({
        slug: 'sekcije-bez-dokumenta',
        name: 'Sekcije',
        eventTypeId: weddingTypeId,
        kind: 'sections',
      })
      .returning({ id: templates.id });

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: template!.id,
        version: 1,
        themeTokens: defaultThemeTokens,
        sections: [],
      })
      .returning({ id: templateVersions.id });

    expect(await loadTemplateVersionPreview(version!.id)).toBeNull();
  });
});
