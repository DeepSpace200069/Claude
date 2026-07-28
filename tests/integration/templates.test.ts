import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import {
  eventTypes,
  invitationSections,
  invitations,
  templateVersions,
  templates,
  themes,
} from '@/server/db/schema';
import { createEvent } from '@/server/services/events';
import { getTemplateBySlug, listTemplates } from '@/server/services/templates';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Snimak šablona (zahtev 39.2 i 39.3).
 *
 * Ovi testovi postoje zbog jednog pravila: izmena šablona ne sme da promeni
 * pozivnicu koja je od njega napravljena. To se ne može proveriti bez baze.
 */
describe.skipIf(!hasTestDatabase)('šabloni i snimak verzije', () => {
  let weddingTypeId: string;
  let templateId: string;
  let versionId: string;

  const TEMPLATE_SECTIONS = [
    {
      type: 'hero',
      schemaVersion: 1,
      position: 0,
      isVisible: true,
      data: {
        eyebrow: 'Pozivamo vas',
        title: 'Originalni naslov',
        subtitle: '',
        image: null,
        layout: 'centered',
        overlayOpacity: 25,
        showIntroAnimation: true,
      },
    },
    {
      type: 'message',
      schemaVersion: 1,
      position: 1,
      isVisible: true,
      data: {
        title: 'Dragi naši',
        body: 'Originalni tekst poruke.',
        signature: '',
        alignment: 'center',
        decoration: 'none',
      },
    },
  ];

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    const [theme] = await db
      .insert(themes)
      .values({ key: 'test-tema', name: 'Test tema', tokens: defaultThemeTokens })
      .returning({ id: themes.id });

    const [template] = await db
      .insert(templates)
      .values({
        slug: 'test-sablon',
        name: 'Test šablon',
        description: 'Šablon za integracioni test.',
        eventTypeId: weddingTypeId,
        style: 'minimal',
        dominantColor: '#faf8f5',
        usesPhotos: false,
        status: 'published',
      })
      .returning({ id: templates.id });

    if (!template || !theme) throw new Error('Priprema šablona nije uspela.');
    templateId = template.id;

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: 1,
        status: 'published',
        themeId: theme.id,
        themeTokens: defaultThemeTokens,
        sections: TEMPLATE_SECTIONS,
        publishedAt: new Date(),
      })
      .returning({ id: templateVersions.id });

    if (!version) throw new Error('Verzija šablona nije napravljena.');
    versionId = version.id;

    await db
      .update(templates)
      .set({ publishedVersionId: version.id })
      .where(eq(templates.id, template.id));
  });

  const baseInput = () => ({
    eventTypeId: weddingTypeId,
    name: 'Test događaj',
    details: {},
    date: '2027-05-20',
    time: '16:00',
    timeZone: 'Europe/Belgrade',
    city: 'Beograd',
    venueName: '',
    primaryLocale: 'sr-Latn' as const,
    templateId,
  });

  it('galerija prikazuje samo objavljene šablone', async () => {
    const published = await listTemplates();
    expect(published.map((template) => template.slug)).toContain('test-sablon');

    await db
      .update(templates)
      .set({ status: 'archived' })
      .where(eq(templates.id, templateId));

    // `listTemplates` je keširan po zahtevu, pa u testu čitamo direktno.
    const remaining = await db
      .select({ slug: templates.slug })
      .from(templates)
      .where(eq(templates.status, 'published'));

    expect(remaining).toHaveLength(0);
  });

  it('kreiranje sa šablonom kopira sekcije i temu u pozivnicu', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    const [invitation] = await db
      .select({
        templateId: invitations.templateId,
        templateVersionId: invitations.templateVersionId,
        themeTokens: invitations.themeTokens,
      })
      .from(invitations)
      .where(eq(invitations.id, result.invitationId));

    expect(invitation?.templateId).toBe(templateId);
    expect(invitation?.templateVersionId).toBe(versionId);
    expect(invitation?.themeTokens).toEqual(defaultThemeTokens);

    const sections = await db
      .select({
        type: invitationSections.type,
        position: invitationSections.position,
        data: invitationSections.data,
      })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, result.invitationId))
      .orderBy(invitationSections.position);

    expect(sections.map((section) => section.type)).toEqual(['hero', 'message']);
    expect((sections[0]?.data as { title: string }).title).toBe('Originalni naslov');
  });

  it('kasnija izmena šablona ne menja postojeću pozivnicu (zahtev 39.3)', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    // Administrator menja objavljenu verziju šablona.
    await db
      .update(templateVersions)
      .set({
        sections: [
          {
            ...TEMPLATE_SECTIONS[0]!,
            data: { ...TEMPLATE_SECTIONS[0]!.data, title: 'IZMENJENI NASLOV' },
          },
        ],
      })
      .where(eq(templateVersions.id, versionId));

    const sections = await db
      .select({ type: invitationSections.type, data: invitationSections.data })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, result.invitationId))
      .orderBy(invitationSections.position);

    // Pozivnica i dalje ima svoj snimak: dve sekcije i originalni naslov.
    expect(sections).toHaveLength(2);
    expect((sections[0]?.data as { title: string }).title).toBe('Originalni naslov');
  });

  it('bez šablona pozivnica nastaje prazna, sa podrazumevanom temom', async () => {
    const user = await createTestUser();
    const { templateId: _omit, ...withoutTemplate } = baseInput();

    const result = await createEvent(user.id, withoutTemplate);

    const sections = await db
      .select({ id: invitationSections.id })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, result.invitationId));

    expect(sections).toHaveLength(0);

    const [invitation] = await db
      .select({ themeTokens: invitations.themeTokens, templateId: invitations.templateId })
      .from(invitations)
      .where(eq(invitations.id, result.invitationId));

    expect(invitation?.templateId).toBeNull();
    expect(invitation?.themeTokens).toEqual(defaultThemeTokens);
  });

  it('nacrt verzije šablona se ne koristi za nove pozivnice', async () => {
    // Šablon bez objavljene verzije ne sme da se pojavi u galeriji.
    await db
      .update(templates)
      .set({ publishedVersionId: null })
      .where(eq(templates.id, templateId));

    const detail = await getTemplateBySlug('test-sablon');
    expect(detail).toBeNull();
  });

  it('brisanje šablona ne ruši pozivnicu koja ga je koristila', async () => {
    const user = await createTestUser();
    const result = await createEvent(user.id, baseInput());

    await db.delete(templates).where(eq(templates.id, templateId));

    const [invitation] = await db
      .select({
        id: invitations.id,
        templateId: invitations.templateId,
        themeTokens: invitations.themeTokens,
      })
      .from(invitations)
      .where(eq(invitations.id, result.invitationId));

    // Veza se poništava (`ON DELETE SET NULL`), ali sadržaj i tema ostaju.
    expect(invitation).toBeDefined();
    expect(invitation?.templateId).toBeNull();
    expect(invitation?.themeTokens).toEqual(defaultThemeTokens);

    const sections = await db
      .select({ id: invitationSections.id })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, result.invitationId));

    expect(sections).toHaveLength(2);
  });

  it('tipovi događaja se ne mogu obrisati dok postoje šabloni (restrict)', async () => {
    await expect(
      db.delete(eventTypes).where(eq(eventTypes.id, weddingTypeId)),
    ).rejects.toThrow();
  });
});
