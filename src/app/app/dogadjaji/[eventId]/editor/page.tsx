import { notFound } from 'next/navigation';

import { EditorApp } from '@/features/editor/editor-shell';
import type { TemplateOption } from '@/features/editor/template-switcher';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { getEventEntitlements } from '@/server/services/entitlements';
import {
  getInvitationForEditor,
  renderContextFor,
} from '@/server/services/invitations';
import { countEventPhotos } from '@/server/services/media';
import { listTemplatesForPlans, listTemplates } from '@/server/services/templates';

/**
 * Uređivač pozivnice (zahtev 8 i 26).
 *
 * Stranica je serverska: proverava pristup, učita sadržaj i prosledi ga
 * klijentskoj aplikaciji uređivača. Uređivač je jedina klijentska celina u
 * projektu koja je zaista velika - zato ovde i staje, a javna pozivnica je
 * nikad ne uvozi (zahtev 39.10).
 */
export default async function EditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireEventPageAccess(eventId, 'invitation:edit');

  const invitation = await getInvitationForEditor(eventId);
  if (!invitation) notFound();

  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);

  const [entitlements, photoCount, templates] = await Promise.all([
    getEventEntitlements(eventId),
    countEventPhotos(eventId),
    listTemplatesForPlans(
      // Sve šablone vidi samo paket koji ih ima; ostali biraju iz besplatnih.
      entitledPlanCodes(),
      invitation.event.eventTypeKey,
    ),
  ]);

  const templateOptions: TemplateOption[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    style: template.style,
  }));

  // Tema šablona služi dugmetu „vrati temu šablona"; ako je šablon u
  // međuvremenu arhiviran, dugmeta jednostavno nema.
  const templateTheme =
    invitation.templateId === null
      ? null
      : ((await listTemplates()).find(
          (template) => template.id === invitation.templateId,
        )?.themeTokens ?? null);

  return (
    <EditorApp
      locale={locale}
      messages={{
        editor: messages.editor,
        sections: messages.sections,
        common: messages.common,
        errors: messages.errors,
        plans: messages.plans,
        validation: messages.validation,
      }}
      config={{
        eventId,
        invitationId: invitation.invitationId,
        publicSlug: invitation.publicSlug,
        entitlements,
        photoCount,
      }}
      document={invitation.document}
      revision={invitation.revision}
      media={invitation.media}
      eventName={invitation.event.name}
      eventTypeKey={invitation.event.eventTypeKey}
      renderContext={renderContextFor(invitation.event, {}, 'preview')}
      templateTheme={templateTheme}
      templateId={invitation.templateId}
      templates={templateOptions}
      issues={invitation.issues}
    />
  );
}

/**
 * Paketi čije šablone nudimo pri promeni.
 *
 * Ponuda je namerno šira od trenutnog paketa: korisnik treba da vidi šta postoji.
 * Stvarna provera prava pri primeni šablona je na serveru, u
 * `switchInvitationTemplate` -> `saveInvitationDraft` (zahtev 39.9).
 */
function entitledPlanCodes(): string[] {
  return ['free', 'standard', 'premium'];
}
