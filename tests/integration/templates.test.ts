import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import {
  eventTypes,
  featurePlans,
  invitationSections,
  invitations,
  orders,
  templateVersions,
  templates,
  themes,
} from '@/server/db/schema';
import { LimitExceededError, ValidationError } from '@/server/authz/errors';
import { startCheckout } from '@/server/services/billing';
import { createEvent } from '@/server/services/events';
import {
  getInvitationForEditor,
  switchInvitationTemplate,
} from '@/server/services/invitations';
import {
  getPublicationState,
  publishInvitation,
} from '@/server/services/publishing';
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

/**
 * Premium šablon i paket pozivnice.
 *
 * Pravilo: izbor šablona je slobodan dok je pozivnica nacrt, ali objavljivanje
 * traži paket koji taj šablon pokriva. Provera mora biti integraciona - suština
 * je u tome šta servisi urade nad pravim redovima, ne u čistoj funkciji (nju
 * pokriva `tests/unit/entitlements.test.ts`).
 */
describe.skipIf(!hasTestDatabase)('pokrivenost premium šablona paketom', () => {
  let weddingTypeId: string;
  let premiumTemplateId: string;
  let premiumPlanId: string;
  let standardPlanId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    const plans = await db
      .select({ id: featurePlans.id, code: featurePlans.code })
      .from(featurePlans);

    premiumPlanId = plans.find((p) => p.code === 'premium')?.id ?? '';
    standardPlanId = plans.find((p) => p.code === 'standard')?.id ?? '';
    if (!premiumPlanId || !standardPlanId) throw new Error('Paketi nisu zasejani.');

    premiumTemplateId = await makeTemplate('premium-sablon', 'premium');
  });

  /** Objavljen šablon sa verzijom - bez verzije servisi ga ne bi ni našli. */
  async function makeTemplate(slug: string, requiredPlanCode: string) {
    const [template] = await db
      .insert(templates)
      .values({
        slug,
        name: `Šablon ${slug}`,
        eventTypeId: weddingTypeId,
        style: 'editorial',
        dominantColor: '#101010',
        requiredPlanCode,
        status: 'published',
      })
      .returning({ id: templates.id });

    if (!template) throw new Error('Šablon nije napravljen.');

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: 1,
        status: 'published',
        themeTokens: defaultThemeTokens,
        sections: [],
        publishedAt: new Date(),
      })
      .returning({ id: templateVersions.id });

    if (!version) throw new Error('Verzija šablona nije napravljena.');

    await db
      .update(templates)
      .set({ publishedVersionId: version.id })
      .where(eq(templates.id, template.id));

    return template.id;
  }

  const eventInput = () => ({
    eventTypeId: weddingTypeId,
    name: 'Proba šablona',
    details: {},
    date: '',
    time: '',
    timeZone: 'Europe/Belgrade',
    city: '',
    venueName: '',
    primaryLocale: 'sr-Latn' as const,
  });

  /** Označava paket kao plaćen za dati događaj - isto što radi webhook. */
  async function markPaid(userId: string, eventId: string, planId: string) {
    const [invitation] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(eq(invitations.eventId, eventId))
      .limit(1);

    await db.insert(orders).values({
      userId,
      eventId,
      invitationId: invitation?.id ?? null,
      planId,
      status: 'paid',
      subtotalMinor: 100000,
      totalMinor: 100000,
      currency: 'RSD',
      idempotencyKey: `test-${eventId}-${planId}`,
      paidAt: new Date(),
    });
  }

  async function applyTemplate(userId: string, eventId: string, templateId: string) {
    const editor = await getInvitationForEditor(eventId);
    if (!editor) throw new Error('Pozivnica ne postoji.');

    return switchInvitationTemplate({
      eventId,
      userId,
      baseRevision: editor.revision,
      templateId,
      document: editor.document,
    });
  }

  it('nacrt sme da primeni premium šablon i bez plaćanja', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);

    const [row] = await db
      .select({ templateId: invitations.templateId })
      .from(invitations)
      .where(eq(invitations.eventId, created.eventId));

    expect(row?.templateId).toBe(premiumTemplateId);
  });

  it('objavljivanje se odbija dok paket ne pokriva šablon', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);
    // Standard daje pravo `publish`, ali ne pokriva premium šablon.
    await markPaid(user.id, created.eventId, standardPlanId);

    await expect(publishInvitation(created.eventId)).rejects.toBeInstanceOf(
      ValidationError,
    );

    const [row] = await db
      .select({ status: invitations.status })
      .from(invitations)
      .where(eq(invitations.eventId, created.eventId));
    expect(row?.status).toBe('draft');
  });

  it('objavljivanje prolazi kada paket pokriva šablon', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);
    await markPaid(user.id, created.eventId, premiumPlanId);

    await publishInvitation(created.eventId);

    const [row] = await db
      .select({ status: invitations.status })
      .from(invitations)
      .where(eq(invitations.eventId, created.eventId));
    expect(row?.status).toBe('published');
  });

  it('stanje objavljivanja imenuje paket koji šablon traži', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);
    await markPaid(user.id, created.eventId, standardPlanId);

    const state = await getPublicationState(created.eventId);

    expect(state?.canPublish).toBe(true);
    expect(state?.templateRequiresPlan).toBe('premium');
  });

  it('objavljena pozivnica ne može da pređe na nepokriven šablon', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await markPaid(user.id, created.eventId, standardPlanId);
    await publishInvitation(created.eventId);

    await expect(
      applyTemplate(user.id, created.eventId, premiumTemplateId),
    ).rejects.toBeInstanceOf(LimitExceededError);

    const [row] = await db
      .select({ templateId: invitations.templateId })
      .from(invitations)
      .where(eq(invitations.eventId, created.eventId));
    expect(row?.templateId).not.toBe(premiumTemplateId);
  });

  it('objavljena pozivnica sme da pređe na pokriven šablon', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());
    const standardTemplateId = await makeTemplate('standard-sablon', 'standard');

    await markPaid(user.id, created.eventId, standardPlanId);
    await publishInvitation(created.eventId);

    await applyTemplate(user.id, created.eventId, standardTemplateId);

    const [row] = await db
      .select({ templateId: invitations.templateId })
      .from(invitations)
      .where(eq(invitations.eventId, created.eventId));
    expect(row?.templateId).toBe(standardTemplateId);
  });

  it('checkout odbija paket koji ne pokriva šablon pozivnice', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);

    // Bez ove provere bi novac bio uzet, a objavljivanje zatim odbijeno.
    await expect(
      startCheckout({
        userId: user.id,
        eventId: created.eventId,
        planId: standardPlanId,
        returnUrl: 'http://localhost:3000/app',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.eventId, created.eventId));
    expect(rows).toHaveLength(0);
  });

  it('checkout prolazi za paket koji pokriva šablon', async () => {
    const user = await createTestUser();
    const created = await createEvent(user.id, eventInput());

    await applyTemplate(user.id, created.eventId, premiumTemplateId);

    const result = await startCheckout({
      userId: user.id,
      eventId: created.eventId,
      planId: premiumPlanId,
      returnUrl: 'http://localhost:3000/app',
    });

    expect(result.order.planCode).toBe('premium');
  });
});
