import { notFound } from 'next/navigation';

import { renderTemplateDocument } from '@/features/invitations/html-document';
import { requireAdminPage } from '@/server/authz/page-guards';
import { splitAtRsvpSlot } from '@/lib/html-template/document';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { loadTemplateVersionPreview } from '@/server/services/template-preview';

import '@/styles/html-invitation.css';

/**
 * Pregled nacrta uvezenog šablona pre objavljivanja (zahtev 7.6 i 39.3).
 *
 * Prikazuje tačno ono što je uvoznik napravio: dokument sa podrazumevanim
 * vrednostima polja i, na mestu ukrasne forme, napomenu umesto prave forme.
 * Ovo nije pozivnica - nema kome da se pošalje odgovor.
 */
export default async function TemplateDraftPreviewPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;

  // Nacrt nije javni sadržaj; proveravaju ga i layout i stranica, jer se svaka
  // od njih može otvoriti i sama.
  await requireAdminPage(`/nacrt-sajta/${versionId}`);

  const preview = await loadTemplateVersionPreview(versionId);
  if (!preview) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const parts = renderTemplateDocument({
    document: preview.document,
    definitions: preview.definitions,
    values: {},
    versionId: preview.versionId,
  });

  const slot = splitAtRsvpSlot(parts?.bodyHtml ?? '');

  return (
    <>
      <div
        className="pozivnica-omotac"
        dangerouslySetInnerHTML={{ __html: slot.before }}
      />

      <section className="pozivnica-rsvp">
        <h2 className="pozivnica-rsvp__title">{t('publicInvitation.rsvpTitle')}</h2>
        <p>{t('templates.demoRsvpNote')}</p>
      </section>

      {slot.after === null ? null : (
        <div
          className="pozivnica-omotac"
          dangerouslySetInnerHTML={{ __html: slot.after }}
        />
      )}

      <p className="pozivnica-potpis">
        {t('admin.templatesDraftPreviewNote', {
          name: preview.templateName,
          version: preview.version,
        })}
      </p>
    </>
  );
}
