import { notFound } from 'next/navigation';

import { renderTemplateDocument } from '@/features/invitations/html-document';
import { splitAtRsvpSlot } from '@/lib/html-template/document';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { getTemplateBySlug } from '@/server/services/templates';

import '@/styles/html-invitation.css';

/**
 * Demo uvezenog sajta (zahtev 6 i 39.4).
 *
 * Prikazuje se sa **podrazumevanim vrednostima polja**, onima koje je uvoznik
 * pokupio iz originalnog sajta. Zbog toga demo izgleda tačno kao ono što je
 * autor napravio, a ne kao prazan kostur sa `{{ime}}` na svakom mestu.
 *
 * Na mestu RSVP forme stoji napomena, ne forma. U demou ne sme da postoji
 * nijedan put kroz koji bi se odgovor upisao - inače bi neko mogao da pomisli da
 * je potvrdio dolazak, a potvrda nigde ne bi bila zapisana (zahtev 39.9).
 */
export default async function HtmlTemplateDemoPage({
  params,
}: {
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  const template = await getTemplateBySlug(templateSlug);

  if (
    !template ||
    template.kind !== 'html' ||
    !template.htmlDocument ||
    !template.fieldDefinitions
  ) {
    notFound();
  }

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const parts = renderTemplateDocument({
    document: template.htmlDocument,
    definitions: template.fieldDefinitions,
    // Prazne vrednosti; `resolveFieldValues` ih dopunjava iz samog šablona.
    values: {},
    versionId: template.versionId,
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
    </>
  );
}
