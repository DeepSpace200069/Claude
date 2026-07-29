import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { addSection, updateSectionData, type EditorDocument } from '@/features/editor/document';
import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import {
  featurePlans,
  invitationRevisions,
  invitationSections,
  invitations,
  templateVersions,
  templates,
  themes,
} from '@/server/db/schema';
import { ConflictError, LimitExceededError, ValidationError } from '@/server/authz/errors';
import { createEvent } from '@/server/services/events';
import {
  MAX_REVISIONS,
  getInvitationForEditor,
  listInvitationRevisions,
  loadRevisionDocument,
  saveInvitationDraft,
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
 * Čuvanje nacrta (zahtev 26 i 39.9).
 *
 * Optimističko zaključavanje, limiti paketa i snimci revizija se ne mogu
 * proveriti bez baze - transakcija i `UPDATE ... WHERE revision = ?` su ovde
 * suština, a ne detalj implementacije.
 */
describe.skipIf(!hasTestDatabase)('uređivač pozivnice', () => {
  let weddingTypeId: string;
  let userId: string;
  let eventId: string;
  let invitationId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    const user = await createTestUser();
    userId = user.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Test pozivnica',
      details: {},
      date: '2027-06-12',
      time: '15:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Restoran Kej',
      primaryLocale: 'sr-Latn',
    });

    eventId = created.eventId;
    invitationId = created.invitationId;
  });

  const documentWith = (...types: string[]): EditorDocument =>
    types.reduce<EditorDocument>(
      (document, type) => {
        const result = addSection(document, type);
        if (!result.ok) throw new Error(`Sekcija "${type}": ${result.reason}`);
        return result.document;
      },
      { theme: defaultThemeTokens, sections: [] },
    );

  const save = (document: EditorDocument, baseRevision: number) =>
    saveInvitationDraft({
      eventId,
      userId,
      baseRevision,
      theme: document.theme,
      sections: document.sections,
    });

  it('upisuje sekcije i uvećava reviziju', async () => {
    const document = documentWith('hero', 'message');
    const result = await save(document, 1);

    expect(result.revision).toBe(2);

    const rows = await db
      .select({
        id: invitationSections.id,
        type: invitationSections.type,
        position: invitationSections.position,
      })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, invitationId))
      .orderBy(invitationSections.position);

    expect(rows.map((row) => row.type)).toEqual(['hero', 'message']);
    // Identifikatore daje klijent, pa ostaju stabilni kroz čuvanja.
    expect(rows.map((row) => row.id)).toEqual(
      document.sections.map((section) => section.id),
    );
  });

  it('drugo čuvanje sa istom osnovnom revizijom prijavljuje sudar', async () => {
    const document = documentWith('hero');
    await save(document, 1);

    // Druga sesija i dalje misli da je revizija 1.
    await expect(save(documentWith('message'), 1)).rejects.toBeInstanceOf(ConflictError);

    // Sudar ne sme da ostavi polovičan upis.
    const rows = await db
      .select({ type: invitationSections.type })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, invitationId));

    expect(rows.map((row) => row.type)).toEqual(['hero']);
  });

  it('sudar nosi trenutnu reviziju, da uređivač ne mora da pogađa', async () => {
    await save(documentWith('hero'), 1);

    await expect(save(documentWith('message'), 1)).rejects.toMatchObject({
      details: { currentRevision: 2 },
    });
  });

  it('odbija sekciju sa neispravnim podacima', async () => {
    const document = documentWith('message');
    const broken = updateSectionData(document, document.sections[0]?.id ?? '', {
      alignment: 'dijagonalno',
    });

    await expect(save(broken, 1)).rejects.toBeInstanceOf(ValidationError);
  });

  it('odbija dve jedinstvene sekcije istog tipa i kada zahtev zaobiđe interfejs', async () => {
    const document = documentWith('hero');
    const duplicated: EditorDocument = {
      ...document,
      sections: [
        ...document.sections,
        { ...document.sections[0]!, id: '11111111-2222-4333-8444-555555555555' },
      ],
    };

    await expect(save(duplicated, 1)).rejects.toBeInstanceOf(ValidationError);
  });

  it('poštuje limit broja sekcija iz paketa', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          limits: { ...DEFAULT_PLANS.free.limits, maxSections: 2 },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    await expect(save(documentWith('hero', 'message', 'footer'), 1)).rejects.toBeInstanceOf(
      LimitExceededError,
    );
  });

  it('odbija sekciju koja nije u paketu, bez obzira na interfejs (zahtev 39.9)', async () => {
    // Besplatan paket nema knjigu želja; dugme je sakriveno, ali odluka je ovde.
    await expect(save(documentWith('guestbook'), 1)).rejects.toBeInstanceOf(
      LimitExceededError,
    );
  });

  it('dozvoljava sekciju kada je paket uključuje', async () => {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          flags: { ...DEFAULT_PLANS.free.flags, guestbook: true },
        },
      })
      .where(eq(featurePlans.code, 'free'));

    await expect(save(documentWith('guestbook'), 1)).resolves.toMatchObject({
      revision: 2,
    });
  });

  it('čitanje za uređivač vraća sekcije sortirane i validirane', async () => {
    await save(documentWith('hero', 'message', 'footer'), 1);

    const loaded = await getInvitationForEditor(eventId);

    expect(loaded?.revision).toBe(2);
    expect(loaded?.document.sections.map((section) => section.type)).toEqual([
      'hero',
      'message',
      'footer',
    ]);
    expect(loaded?.issues).toEqual([]);
  });

  it('oštećena sekcija u bazi se prijavljuje, ali pozivnica se i dalje otvara', async () => {
    await save(documentWith('hero', 'message'), 1);

    await db
      .update(invitationSections)
      .set({ data: { alignment: 'dijagonalno' } })
      .where(eq(invitationSections.type, 'message'));

    const loaded = await getInvitationForEditor(eventId);

    expect(loaded?.document.sections).toHaveLength(2);
    expect(loaded?.issues).toHaveLength(1);
  });

  describe('revizije', () => {
    it('prvo čuvanje pravi snimak, a brza uzastopna čuvanja ne prave nove', async () => {
      await save(documentWith('hero'), 1);
      await save(documentWith('hero', 'message'), 2);
      await save(documentWith('hero', 'message', 'footer'), 3);

      const revisions = await listInvitationRevisions(invitationId);

      // Snimak se pravi najviše jednom u intervalu - inače bi svako kucanje
      // ostavljalo zapis, a istorija bi postala beskorisna.
      expect(revisions).toHaveLength(1);
      expect(revisions[0]?.sectionCount).toBe(1);
    });

    it('snimak čuva sadržaj koji se može vratiti u uređivač', async () => {
      const document = documentWith('message');
      const filled = updateSectionData(document, document.sections[0]?.id ?? '', {
        title: 'Prva verzija',
        body: '',
        signature: '',
        alignment: 'center',
        decoration: 'none',
      });

      await save(filled, 1);

      const [revision] = await listInvitationRevisions(invitationId);
      expect(revision).toBeDefined();

      const restored = await loadRevisionDocument(invitationId, revision!.id);

      expect(restored.sections).toHaveLength(1);
      expect((restored.sections[0]?.data as { title: string }).title).toBe(
        'Prva verzija',
      );
      // Vraćena verzija dobija nove identifikatore - ne sme da gazi žive sekcije.
      expect(restored.sections[0]?.id).not.toBe(filled.sections[0]?.id);
    });

    it('istorija je ograničena, najstarije se brišu', async () => {
      const existing = MAX_REVISIONS + 5;

      // Snimke pravimo direktno da ne bismo čekali interval između čuvanja.
      for (let index = 0; index < existing; index += 1) {
        await db.insert(invitationRevisions).values({
          invitationId,
          revision: index + 1,
          themeTokens: defaultThemeTokens,
          sections: [],
          createdById: userId,
        });
      }

      // Pozivnica mora da bude na istoj reviziji kao istorija: brojevi rastu
      // zajedno, pa sledeće čuvanje dobija broj iznad svih postojećih snimaka.
      await db
        .update(invitations)
        .set({ revision: existing })
        .where(eq(invitations.id, invitationId));

      // Vraćamo vreme unazad da snimak ne bi bio preskočen zbog intervala.
      await db
        .update(invitationRevisions)
        .set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(eq(invitationRevisions.invitationId, invitationId));

      await save(documentWith('hero'), existing);

      const revisions = await listInvitationRevisions(invitationId);

      expect(revisions).toHaveLength(MAX_REVISIONS);
      // Najnoviji snimak je onaj koji je upravo napravljen.
      expect(revisions[0]?.revision).toBe(existing + 1);
      expect(revisions[0]?.sectionCount).toBe(1);
    });

    it('sudar u istoriji ne obara čuvanje sadržaja', async () => {
      // Stanje koje u normalnom radu ne nastaje, ali može posle vraćanja baze
      // iz rezervne kopije: snimak za sledeću reviziju već postoji.
      await db.insert(invitationRevisions).values({
        invitationId,
        revision: 2,
        themeTokens: defaultThemeTokens,
        sections: [],
        createdById: userId,
      });

      await expect(save(documentWith('hero'), 1)).resolves.toMatchObject({
        revision: 2,
      });

      const rows = await db
        .select({ type: invitationSections.type })
        .from(invitationSections)
        .where(eq(invitationSections.invitationId, invitationId));

      expect(rows.map((row) => row.type)).toEqual(['hero']);
    });

    it('revizija druge pozivnice nije dostupna', async () => {
      await save(documentWith('hero'), 1);
      const [revision] = await listInvitationRevisions(invitationId);

      const other = await createEvent(userId, {
        eventTypeId: weddingTypeId,
        name: 'Druga pozivnica',
        details: {},
        date: '',
        time: '',
        timeZone: 'Europe/Belgrade',
        city: '',
        venueName: '',
        primaryLocale: 'sr-Latn',
      });

      await expect(
        loadRevisionDocument(other.invitationId, revision!.id),
      ).rejects.toThrow();
    });
  });

  describe('promena šablona', () => {
    let templateId: string;

    beforeEach(async () => {
      const [theme] = await db
        .insert(themes)
        .values({ key: 'druga-tema', name: 'Druga', tokens: defaultThemeTokens })
        .returning({ id: themes.id });

      const [template] = await db
        .insert(templates)
        .values({
          slug: 'drugi-sablon',
          name: 'Drugi šablon',
          description: 'Za test promene šablona.',
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
          themeTokens: {
            ...defaultThemeTokens,
            palette: { ...defaultThemeTokens.palette, accent: '#123456' },
          },
          sections: [
            {
              type: 'hero',
              schemaVersion: 1,
              position: 0,
              isVisible: true,
              data: {
                eyebrow: '',
                title: 'Naslov iz šablona',
                subtitle: '',
                image: null,
                layout: 'centered',
                overlayOpacity: 25,
                showIntroAnimation: true,
              },
            },
            {
              type: 'locations',
              schemaVersion: 1,
              position: 1,
              isVisible: true,
              data: { title: '', intro: '', layout: 'cards', locations: [] },
            },
          ],
          publishedAt: new Date(),
        })
        .returning({ id: templateVersions.id });

      await db
        .update(templates)
        .set({ publishedVersionId: version!.id })
        .where(eq(templates.id, template.id));
    });

    it('zadržava uneti sadržaj i upisuje novi snimak verzije šablona', async () => {
      const document = documentWith('hero');
      const filled = updateSectionData(document, document.sections[0]?.id ?? '', {
        eyebrow: '',
        title: 'Ana i Marko',
        subtitle: '',
        image: null,
        layout: 'centered',
        overlayOpacity: 25,
        showIntroAnimation: true,
      });

      await save(filled, 1);

      const result = await switchInvitationTemplate({
        eventId,
        userId,
        baseRevision: 2,
        templateId,
        document: filled,
      });

      expect(result.document.theme.palette.accent).toBe('#123456');
      expect((result.document.sections[0]?.data as { title: string }).title).toBe(
        'Ana i Marko',
      );

      const [invitation] = await db
        .select({
          templateId: invitations.templateId,
          templateVersionId: invitations.templateVersionId,
        })
        .from(invitations)
        .where(eq(invitations.id, invitationId));

      expect(invitation?.templateId).toBe(templateId);
      expect(invitation?.templateVersionId).not.toBeNull();
    });

    it('„bez šablona" zadržava sadržaj i vraća podrazumevanu temu', async () => {
      await save(documentWith('hero', 'message'), 1);

      const current = await getInvitationForEditor(eventId);

      const result = await switchInvitationTemplate({
        eventId,
        userId,
        baseRevision: current!.revision,
        templateId: null,
        document: current!.document,
      });

      expect(result.document.sections.map((section) => section.type)).toEqual([
        'hero',
        'message',
      ]);
      expect(result.document.theme).toEqual(defaultThemeTokens);
    });

    it('nedostupan šablon se odbija', async () => {
      await db
        .update(templates)
        .set({ status: 'archived' })
        .where(eq(templates.id, templateId));

      await expect(
        switchInvitationTemplate({
          eventId,
          userId,
          baseRevision: 1,
          templateId,
          document: documentWith('hero'),
        }),
      ).rejects.toThrow();
    });
  });
});
