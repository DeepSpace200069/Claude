'use server';

import { revalidatePath } from 'next/cache';

import type { EditorDocument } from '@/features/editor/document';
import {
  loadRevisionSchema,
  saveInvitationFieldsSchema,
  saveInvitationSchema,
  switchHtmlTemplateSchema,
  switchTemplateSchema,
} from '@/features/editor/schemas';
import type {
  FieldDefinitions,
  FieldValues,
} from '@/features/templates/html-schema';
import { requireEventAccess } from '@/server/authz';
import { NotFoundError } from '@/server/authz/errors';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import {
  getInvitationForEditor,
  listInvitationRevisions,
  loadRevisionDocument,
  loadRevisionFieldValues,
  saveInvitationDraft,
  saveInvitationFields,
  switchInvitationHtmlTemplate,
  switchInvitationTemplate,
  type RevisionSummary,
} from '@/server/services/invitations';
import { revalidateInvitation } from '@/server/services/public-invitation';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Server akcije uređivača pozivnice.
 *
 * Svaka akcija ide istim redom: autentifikacija i dozvola nad **konkretnim**
 * događajem, ograničenje učestalosti, validacija, pa posao. Uređivač je
 * klijentska aplikacija, pa je ovo jedina tačka u kojoj se odlučuje šta sme -
 * skrivanje dugmeta u interfejsu nije zaštita (zahtev 24 i 39.5).
 */

export type SaveResult = { revision: number; savedAt: string };

export async function saveInvitationAction(
  input: unknown,
): Promise<ActionResult<SaveResult>> {
  try {
    const parsed = saveInvitationSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Izmene nisu u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    // Autosave šalje često, ali ne beskonačno: granica je iznad realnog ritma
    // kucanja, a hvata petlju u klijentu i automatizovano zatrpavanje.
    const limit = await rateLimit(
      `save-invitation:${access.user.id}:${parsed.data.eventId}`,
      RATE_LIMITS.saveInvitation,
    );
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše izmena u kratkom roku. Sačekajte trenutak pa pokušajte ponovo.',
      );
    }

    const result = await saveInvitationDraft({
      eventId: parsed.data.eventId,
      userId: access.user.id,
      baseRevision: parsed.data.baseRevision,
      theme: parsed.data.theme,
      sections: parsed.data.sections.map((section) => ({
        id: section.id,
        type: section.type,
        schemaVersion: section.schemaVersion,
        position: section.position,
        isVisible: section.isVisible,
        data: section.data,
      })),
    });

    // Keš javne stranice se poništava odmah: organizator koji sačuva izmenu i
    // otvori javni link mora da vidi novo stanje, a ne prethodno (zahtev 4.7).
    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);

    return success({
      revision: result.revision,
      savedAt: result.savedAt.toISOString(),
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function switchTemplateAction(
  input: unknown,
): Promise<ActionResult<SaveResult & { document: EditorDocument }>> {
  try {
    const parsed = switchTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Zahtev nije u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const result = await switchInvitationTemplate({
      eventId: parsed.data.eventId,
      userId: access.user.id,
      baseRevision: parsed.data.baseRevision,
      templateId: parsed.data.templateId,
      document: {
        theme: parsed.data.theme,
        sections: parsed.data.sections.map((section) => ({
          id: section.id,
          type: section.type,
          schemaVersion: section.schemaVersion,
          position: section.position,
          isVisible: section.isVisible,
          data: section.data,
        })),
      },
    });

    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);

    return success({
      revision: result.revision,
      savedAt: result.savedAt.toISOString(),
      document: result.document,
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Čuvanje vrednosti polja HTML pozivnice (zahtev 39.4).
 *
 * Ista pravila kao za sekcije - dozvola nad konkretnim događajem, isto
 * ograničenje učestalosti, ista detekcija sudara - samo je sadržaj drugi. Greške
 * po polju se vraćaju u `fieldErrors`, pa forma poruku prikaže uz samo polje, a
 * ne kao opšte upozorenje.
 */
export async function saveInvitationFieldsAction(
  input: unknown,
): Promise<ActionResult<SaveResult>> {
  try {
    const parsed = saveInvitationFieldsSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Izmene nisu u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const limit = await rateLimit(
      `save-invitation:${access.user.id}:${parsed.data.eventId}`,
      RATE_LIMITS.saveInvitation,
    );
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše izmena u kratkom roku. Sačekajte trenutak pa pokušajte ponovo.',
      );
    }

    const result = await saveInvitationFields({
      eventId: parsed.data.eventId,
      userId: access.user.id,
      baseRevision: parsed.data.baseRevision,
      values: parsed.data.values,
    });

    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);

    return success({
      revision: result.revision,
      savedAt: result.savedAt.toISOString(),
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function switchHtmlTemplateAction(
  input: unknown,
): Promise<
  ActionResult<SaveResult & { definitions: FieldDefinitions; values: FieldValues }>
> {
  try {
    const parsed = switchHtmlTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Zahtev nije u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const result = await switchInvitationHtmlTemplate({
      eventId: parsed.data.eventId,
      userId: access.user.id,
      baseRevision: parsed.data.baseRevision,
      templateId: parsed.data.templateId,
      values: parsed.data.values,
    });

    revalidateInvitation(result.slug);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}`);

    return success({
      revision: result.revision,
      savedAt: result.savedAt.toISOString(),
      definitions: result.definitions,
      values: result.values,
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

/** Vrednosti polja iz starije revizije; pandan `loadRevisionAction`. */
export async function loadRevisionFieldsAction(
  input: unknown,
): Promise<ActionResult<{ values: FieldValues }>> {
  try {
    const parsed = loadRevisionSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Zahtev nije u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const invitation = await getInvitationForEditor(parsed.data.eventId);
    if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

    const values = await loadRevisionFieldValues(
      invitation.invitationId,
      parsed.data.revisionId,
    );

    return success({ values });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function listRevisionsAction(
  eventId: unknown,
): Promise<ActionResult<RevisionSummary[]>> {
  try {
    if (typeof eventId !== 'string') {
      return failure('validation', 'Nedostaje identifikator događaja.');
    }

    await requireEventAccess(eventId, 'invitation:edit');

    const invitation = await getInvitationForEditor(eventId);
    if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

    return success(await listInvitationRevisions(invitation.invitationId));
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Učitavanje starije verzije u uređivač.
 *
 * Ne upisuje ništa - vraća dokument koji uređivač ubaci kao običnu izmenu.
 * Korisnik prvo vidi šta dobija, a „poništi" i dalje radi.
 */
export async function loadRevisionAction(
  input: unknown,
): Promise<ActionResult<{ document: EditorDocument }>> {
  try {
    const parsed = loadRevisionSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Zahtev nije u očekivanom obliku.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const invitation = await getInvitationForEditor(parsed.data.eventId);
    if (!invitation) throw new NotFoundError('Pozivnica ne postoji.');

    const document = await loadRevisionDocument(
      invitation.invitationId,
      parsed.data.revisionId,
    );

    return success({ document });
  } catch (error) {
    return toActionFailure(error);
  }
}
