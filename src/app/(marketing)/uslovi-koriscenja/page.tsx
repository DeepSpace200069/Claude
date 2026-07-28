import type { Metadata } from 'next';

import { getTerms } from '@/content/legal';
import { LegalPage } from '@/features/legal/legal-page';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('nav.terms'),
    alternates: { canonical: appUrl('/uslovi-koriscenja') },
  };
}

/** Uslovi korišćenja (zahtev 6). */
export default async function TermsPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const { document, isFallback } = getTerms(locale);

  return (
    <LegalPage
      title={t('nav.terms')}
      document={document}
      locale={locale}
      isFallback={isFallback}
      labels={{
        updated: t('pages.legalUpdated'),
        draftNotice: t('pages.legalDraftNotice'),
        fallbackNotice: t('pages.legalFallbackNotice'),
      }}
    />
  );
}
