import { notFound } from 'next/navigation';

import { EditorApp } from '@/features/editor/editor-shell';
import { FieldEditorApp } from '@/features/editor/html/field-editor';
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
 * Uređivač pozivnice (zahtev 8, 26 i 39.4).
 *
 * Stranica je serverska: proverava pristup, učita sadržaj i prosledi ga
 * klijentskoj aplikaciji uređivača. Uređivač je jedina klijentska celina u
 * projektu koja je zaista velika - zato ovde i staje, a javna pozivnica je
 * nikad ne uvozi (zahtev 39.10).
 *
 * Odavde se granaju **dva** uređivača, prema vrsti šablona: pozivnica od sekcija
 * dobija uređivač sekcija, a pozivnica napravljena od uvezenog sajta formu polja,
 * jer se u njoj raspored ne menja. Grananje je ovde, na jednom mestu - dva
 * sasvim različita stanja u istoj klijentskoj celini značila bi da svaka strana
 * u paket vuče i onu drugu.
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

  const [entitlements, photoCount] = await Promise.all([
    getEventEntitlements(eventId),
    countEventPhotos(eventId),
  ]);

  const config = {
    eventId,
    invitationId: invitation.invitationId,
    publicSlug: invitation.publicSlug,
    entitlements,
    photoCount,
  };

  if (invitation.html) {
    /*
     * Verzija šablona je u međuvremenu nestala. Definicije polja pozivnica i
     * dalje ima, ali dokumenta nema, pa nema šta da se uređuje - „nije nađeno"
     * je iskrenije od prazne forme koja bi tiho čuvala vrednosti u prazno.
     */
    if (invitation.html.status !== 'ok') notFound();

    const templates = await listTemplatesForPlans(
      entitledPlanCodes(),
      invitation.event.eventTypeKey,
      'html',
    );

    return (
      <FieldEditorApp
        locale={locale}
        messages={{
          editor: messages.editor,
          common: messages.common,
          errors: messages.errors,
          validation: messages.validation,
        }}
        config={config}
        eventName={invitation.event.name}
        revision={invitation.revision}
        media={invitation.media}
        document={invitation.html.document}
        definitions={invitation.html.definitions}
        values={invitation.html.values}
        templateVersionId={invitation.html.versionId}
        templateId={invitation.templateId}
        templates={templates.map(toOption)}
      />
    );
  }

  const templates = await listTemplatesForPlans(
    // Sve šablone vidi samo paket koji ih ima; ostali biraju iz besplatnih.
    entitledPlanCodes(),
    invitation.event.eventTypeKey,
    'sections',
  );

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
      config={config}
      document={invitation.document}
      revision={invitation.revision}
      media={invitation.media}
      eventName={invitation.event.name}
      eventTypeKey={invitation.event.eventTypeKey}
      renderContext={renderContextFor(invitation.event, {}, 'preview')}
      templateTheme={templateTheme}
      templateId={invitation.templateId}
      templates={templates.map(toOption)}
      issues={invitation.issues}
    />
  );
}

function toOption(template: {
  id: string;
  name: string;
  description: string;
  style: string;
}): TemplateOption {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    style: template.style,
  };
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
