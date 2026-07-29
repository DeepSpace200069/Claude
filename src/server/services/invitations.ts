import 'server-only';

import { and, asc, desc, eq, isNull, lt, sql } from 'drizzle-orm';

import {
  FEATURE_FLAGS,
  can,
  checkLimit,
  type FeatureFlag,
} from '@/features/billing/entitlements';
import {
  applyTemplateToDocument,
  documentFromRecords,
  validateDocument,
  type EditorDocument,
  type EditorSection,
} from '@/features/editor/document';
import type { EventDetails } from '@/features/events/details';
import { getSectionDefinition } from '@/features/sections/registry';
import type { InvitationRenderContext, MediaResolution } from '@/features/sections/types';
import { defaultThemeTokens, type ThemeTokens } from '@/features/themes/tokens';
import type { Locale } from '@/i18n/config';
import { newId } from '@/lib/uuid';
import { db } from '@/server/db';
import {
  eventTypes,
  events,
  invitationRevisions,
  invitationSections,
  invitations,
  templateVersions,
  templates,
} from '@/server/db/schema';
import {
  ConflictError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '@/server/authz/errors';

import { getUserEntitlements } from './entitlements';
import { listEventMedia, mediaMapFrom, type MediaAsset } from './media';

/**
 * Pozivnica u uređivaču (zahtev 8, 26 i 39.4).
 *
 * Uređivač i javni prikaz čitaju **isti** model: sekcije prolaze kroz istu
 * migraciju i istu Zod validaciju. Zbog toga pregled u uređivaču ne može da
 * prikaže nešto što objavljena pozivnica ne bi.
 */

/** Koliko revizija čuvamo po pozivnici. */
export const MAX_REVISIONS = 20;

/**
 * Najmanji razmak između dva snimka revizije.
 *
 * Autosave se okida na svakih nekoliko sekundi kucanja; kad bi svaki upis pravio
 * reviziju, istorija bi za sat vremena rada imala hiljade beskorisnih koraka.
 * Ovako revizija znači „stanje od pre nekog vremena", što je ono zbog čega
 * korisnik i traži istoriju.
 */
export const REVISION_INTERVAL_MS = 5 * 60 * 1000;

export type EditorEvent = {
  id: string;
  name: string;
  eventTypeKey: string;
  eventTypeLabelKey: string;
  startsAt: Date | null;
  timeZone: string;
  city: string | null;
  venueName: string | null;
  details: EventDetails;
  primaryLocale: Locale;
};

export type EditorInvitation = {
  invitationId: string;
  publicSlug: string;
  status: 'draft' | 'published' | 'unpublished';
  revision: number;
  templateId: string | null;
  templateVersionId: string | null;
  document: EditorDocument;
  event: EditorEvent;
  media: MediaAsset[];
  /** Sekcije koje nisu mogle da se pročitaju - prikazuju se kao upozorenje. */
  issues: Array<{ sectionId: string; message: string }>;
};

export async function getInvitationForEditor(
  eventId: string,
): Promise<EditorInvitation | null> {
  const [row] = await db
    .select({
      invitationId: invitations.id,
      publicSlug: invitations.publicSlug,
      status: invitations.status,
      revision: invitations.revision,
      templateId: invitations.templateId,
      templateVersionId: invitations.templateVersionId,
      themeTokens: invitations.themeTokens,
      eventId: events.id,
      name: events.name,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      city: events.city,
      venueName: events.venueName,
      details: events.details,
      primaryLocale: events.primaryLocale,
      eventTypeKey: eventTypes.key,
      eventTypeLabelKey: eventTypes.labelKey,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!row) return null;

  const [sectionRows, media] = await Promise.all([
    db
      .select({
        id: invitationSections.id,
        type: invitationSections.type,
        schemaVersion: invitationSections.schemaVersion,
        position: invitationSections.position,
        isVisible: invitationSections.isVisible,
        data: invitationSections.data,
      })
      .from(invitationSections)
      .where(eq(invitationSections.invitationId, row.invitationId))
      .orderBy(asc(invitationSections.position)),
    listEventMedia(eventId),
  ]);

  const issues: Array<{ sectionId: string; message: string }> = [];
  const document = documentFromRecords(row.themeTokens, sectionRows, (sectionId, message) =>
    issues.push({ sectionId, message }),
  );

  return {
    invitationId: row.invitationId,
    publicSlug: row.publicSlug,
    status: row.status,
    revision: row.revision,
    templateId: row.templateId,
    templateVersionId: row.templateVersionId,
    document,
    event: {
      id: row.eventId,
      name: row.name,
      eventTypeKey: row.eventTypeKey,
      eventTypeLabelKey: row.eventTypeLabelKey,
      startsAt: row.startsAt,
      timeZone: row.timeZone,
      city: row.city,
      venueName: row.venueName,
      details: row.details,
      primaryLocale: row.primaryLocale,
    },
    media,
    issues,
  };
}

/** Kontekst za prikaz pozivnice; isti oblik koristi i javna stranica. */
export function renderContextFor(
  event: EditorEvent,
  media: Record<string, MediaResolution>,
  mode: InvitationRenderContext['mode'],
): InvitationRenderContext {
  return {
    mode,
    eventTypeKey: event.eventTypeKey,
    startsAt: event.startsAt?.toISOString() ?? null,
    timeZone: event.timeZone,
    city: event.city,
    venueName: event.venueName,
    details: event.details as Record<string, unknown>,
    media,
  };
}

export function editorRenderContext(
  invitation: EditorInvitation,
): InvitationRenderContext {
  return renderContextFor(
    invitation.event,
    mediaMapFrom(invitation.media),
    'preview',
  );
}

// --- Čuvanje ----------------------------------------------------------------

export type SaveDraftInput = {
  eventId: string;
  userId: string;
  baseRevision: number;
  theme: ThemeTokens;
  sections: EditorSection[];
};

export type SaveDraftResult = {
  revision: number;
  savedAt: Date;
  /** Javni slug - pozivaocu treba da poništi keš javne stranice. */
  slug: string;
};

/**
 * Čuvanje nacrta sa optimističkim zaključavanjem.
 *
 * `UPDATE ... WHERE revision = :baseRevision` je jedini bezbedan način da se
 * otkrije istovremena izmena: provera pa upis u dva koraka ostavlja prozor u
 * kome druga sesija upiše svoje. Ako nijedan red nije pogođen, izmena je
 * zasnovana na zastareloj verziji i vraćamo `ConflictError` (zahtev 26).
 */
export async function saveInvitationDraft(
  input: SaveDraftInput,
): Promise<SaveDraftResult> {
  const [invitation] = await db
    .select({
      id: invitations.id,
      revision: invitations.revision,
      status: invitations.status,
      slug: invitations.publicSlug,
    })
    .from(invitations)
    .where(eq(invitations.eventId, input.eventId))
    .limit(1);

  if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

  await assertSectionsAllowed(input.userId, input.sections);

  const issues = validateDocument({ theme: input.theme, sections: input.sections });
  if (issues.length > 0) {
    throw new ValidationError('Neke sekcije nisu ispravno popunjene.', {
      sections: issues.map((issue) => `${issue.type}: ${issue.message}`),
    });
  }

  const savedAt = new Date();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(invitations)
      .set({ revision: invitation.revision + 1, themeTokens: input.theme, updatedAt: savedAt })
      .where(
        and(
          eq(invitations.id, invitation.id),
          eq(invitations.revision, input.baseRevision),
        ),
      )
      .returning({ revision: invitations.revision });

    if (updated.length === 0) {
      throw new ConflictError(
        'Pozivnica je u međuvremenu izmenjena na drugom mestu.',
        { currentRevision: invitation.revision },
      );
    }

    /*
     * Sekcije se upisuju kao celina: redosled, vidljivost i sadržaj se menjaju
     * zajedno, a broj sekcija je mali (gornja granica je limit paketa). Diff bi
     * ovde doneo složenost bez ijedne koristi. Identifikatore daje klijent, pa
     * ostaju stabilni kroz čuvanja - React ključevi i istorija se ne pomeraju.
     */
    await tx
      .delete(invitationSections)
      .where(eq(invitationSections.invitationId, invitation.id));

    if (input.sections.length > 0) {
      await tx.insert(invitationSections).values(
        input.sections.map((section, index) => ({
          id: section.id,
          invitationId: invitation.id,
          type: section.type,
          schemaVersion: section.schemaVersion,
          position: index,
          isVisible: section.isVisible,
          data: section.data,
        })),
      );
    }

    await writeRevisionSnapshot(tx, {
      invitationId: invitation.id,
      revision: invitation.revision + 1,
      userId: input.userId,
      theme: input.theme,
      sections: input.sections,
      now: savedAt,
    });

    return { revision: invitation.revision + 1, savedAt, slug: invitation.slug };
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Snimak revizije, ali ne pri svakom čuvanju.
 *
 * Pravi se prvi snimak, pa zatim najviše jedan na `REVISION_INTERVAL_MS`.
 * Starije od `MAX_REVISIONS` se brišu da tabela ne raste bez granice.
 */
async function writeRevisionSnapshot(
  tx: Transaction,
  input: {
    invitationId: string;
    revision: number;
    userId: string;
    theme: ThemeTokens;
    sections: readonly EditorSection[];
    now: Date;
  },
): Promise<void> {
  const [latest] = await tx
    .select({ createdAt: invitationRevisions.createdAt })
    .from(invitationRevisions)
    .where(eq(invitationRevisions.invitationId, input.invitationId))
    .orderBy(desc(invitationRevisions.revision))
    .limit(1);

  if (
    latest &&
    input.now.getTime() - latest.createdAt.getTime() < REVISION_INTERVAL_MS
  ) {
    return;
  }

  await tx
    .insert(invitationRevisions)
    .values({
      invitationId: input.invitationId,
      revision: input.revision,
      themeTokens: input.theme,
      sections: input.sections.map((section, index) => ({
        type: section.type,
        schemaVersion: section.schemaVersion,
        position: index,
        isVisible: section.isVisible,
        data: section.data,
      })),
      createdById: input.userId,
    })
    /*
     * Snimak je pogodnost, a sadržaj pozivnice je ono što korisnik zaista čuva.
     * Ako za tu reviziju snimak već postoji - što u normalnom radu ne može, ali
     * može posle vraćanja baze iz rezervne kopije - preskačemo ga umesto da
     * pukne cela transakcija i korisnik izgubi izmenu koju je upravo otkucao.
     */
    .onConflictDoNothing({
      target: [invitationRevisions.invitationId, invitationRevisions.revision],
    });

  const [cutoff] = await tx
    .select({ revision: invitationRevisions.revision })
    .from(invitationRevisions)
    .where(eq(invitationRevisions.invitationId, input.invitationId))
    .orderBy(desc(invitationRevisions.revision))
    .limit(1)
    .offset(MAX_REVISIONS - 1);

  if (cutoff) {
    await tx
      .delete(invitationRevisions)
      .where(
        and(
          eq(invitationRevisions.invitationId, input.invitationId),
          lt(invitationRevisions.revision, cutoff.revision),
        ),
      );
  }
}

/**
 * Provera da li paket dozvoljava upravo poslate sekcije.
 *
 * Ovde se hvata i broj sekcija i pojedinačne mogućnosti (`requiresFeature`), pa
 * korisnik na besplatnom paketu ne može da sačuva knjigu želja ni ako pošalje
 * zahtev direktno, mimo interfejsa (zahtev 39.9).
 */
async function assertSectionsAllowed(
  userId: string,
  sections: readonly EditorSection[],
): Promise<void> {
  const entitlements = await getUserEntitlements(userId);

  const limit = checkLimit(entitlements, 'maxSections', 0, sections.length);
  if (!limit.allowed) {
    throw new LimitExceededError(
      `Vaš paket dozvoljava najviše ${limit.limit} sekcija u pozivnici.`,
      { limit: limit.limit, current: sections.length, feature: 'maxSections' },
    );
  }

  const seen = new Set<string>();

  for (const section of sections) {
    const definition = getSectionDefinition(section.type);
    if (!definition) {
      throw new ValidationError(`Nepoznat tip sekcije: "${section.type}".`);
    }

    if (definition.singleton === true) {
      if (seen.has(section.type)) {
        throw new ValidationError(
          'Ova sekcija sme da postoji samo jednom u pozivnici.',
          { sections: [section.type] },
        );
      }
      seen.add(section.type);
    }

    const feature = definition.requiresFeature;
    if (feature && isFeatureFlag(feature) && !can(entitlements, feature)) {
      throw new LimitExceededError(
        'Ova sekcija nije uključena u vaš paket.',
        { limit: 0, current: 1, feature },
      );
    }
  }
}

function isFeatureFlag(value: string): value is FeatureFlag {
  return (FEATURE_FLAGS as readonly string[]).includes(value);
}

// --- Šabloni ----------------------------------------------------------------

/**
 * Prelazak na drugi šablon (zahtev 3.12).
 *
 * Sadržaj koji je korisnik uneo se zadržava, šablon donosi raspored i temu -
 * detalji pravila su u `applyTemplateToDocument`. Snimak verzije šablona se
 * ponovo upisuje u pozivnicu, pa kasnija izmena tog šablona i dalje ne dira
 * ovu pozivnicu (zahtev 39.2 i 39.3).
 */
export async function switchInvitationTemplate(input: {
  eventId: string;
  userId: string;
  baseRevision: number;
  templateId: string | null;
  document: EditorDocument;
}): Promise<SaveDraftResult & { document: EditorDocument }> {
  let nextDocument: EditorDocument;
  let templateVersionId: string | null = null;

  if (input.templateId === null) {
    // „Bez šablona": zadržavamo sadržaj, vraćamo podrazumevanu temu.
    nextDocument = { ...input.document, theme: defaultThemeTokens };
  } else {
    const [snapshot] = await db
      .select({
        templateId: templates.id,
        versionId: templateVersions.id,
        themeTokens: templateVersions.themeTokens,
        sections: templateVersions.sections,
      })
      .from(templates)
      .innerJoin(
        templateVersions,
        eq(templates.publishedVersionId, templateVersions.id),
      )
      .where(
        and(eq(templates.id, input.templateId), eq(templates.status, 'published')),
      )
      .limit(1);

    if (!snapshot) throw new NotFoundError('Izabrani šablon nije dostupan.');

    templateVersionId = snapshot.versionId;
    nextDocument = applyTemplateToDocument(input.document, {
      themeTokens: snapshot.themeTokens,
      sections: snapshot.sections,
    });
  }

  const saved = await saveInvitationDraft({
    eventId: input.eventId,
    userId: input.userId,
    baseRevision: input.baseRevision,
    theme: nextDocument.theme,
    sections: nextDocument.sections,
  });

  await db
    .update(invitations)
    .set({ templateId: input.templateId, templateVersionId })
    .where(eq(invitations.eventId, input.eventId));

  return { ...saved, document: nextDocument };
}

// --- Revizije ---------------------------------------------------------------

export type RevisionSummary = {
  id: string;
  revision: number;
  createdAt: Date;
  sectionCount: number;
};

export async function listInvitationRevisions(
  invitationId: string,
): Promise<RevisionSummary[]> {
  const rows = await db
    .select({
      id: invitationRevisions.id,
      revision: invitationRevisions.revision,
      createdAt: invitationRevisions.createdAt,
      sectionCount: sql<number>`jsonb_array_length(${invitationRevisions.sections})::int`,
    })
    .from(invitationRevisions)
    .where(eq(invitationRevisions.invitationId, invitationId))
    .orderBy(desc(invitationRevisions.revision));

  return rows;
}

/**
 * Učitavanje starije revizije u uređivač.
 *
 * Namerno **ne** upisuje odmah: vraća dokument koji uređivač ubaci kao izmenu.
 * Korisnik tako vidi šta dobija, može da poništi vraćanje običnim „poništi", a
 * upis ide kroz isto čuvanje kao svaka druga izmena.
 */
export async function loadRevisionDocument(
  invitationId: string,
  revisionId: string,
): Promise<EditorDocument> {
  const [row] = await db
    .select({
      themeTokens: invitationRevisions.themeTokens,
      sections: invitationRevisions.sections,
    })
    .from(invitationRevisions)
    .where(
      and(
        eq(invitationRevisions.id, revisionId),
        eq(invitationRevisions.invitationId, invitationId),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError('Ta verzija pozivnice ne postoji.');

  return documentFromRecords(
    row.themeTokens,
    row.sections.map((section) => ({
      // Snimak ne pamti identifikatore sekcija - oni pripadaju živom dokumentu,
      // a ne istoriji. Vraćena verzija zato dobija nove identifikatore i u
      // uređivač ulazi kao obična izmena, koju „poništi" može da vrati.
      id: newId(),
      type: section.type,
      schemaVersion: section.schemaVersion,
      position: section.position,
      isVisible: section.isVisible,
      data: section.data,
    })),
  );
}
