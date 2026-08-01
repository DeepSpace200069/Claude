import type { Metadata } from 'next';

import { getPrivacy } from '@/content/legal';
import { LegalPage } from '@/features/legal/legal-page';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('nav.privacy'),
    alternates: { canonical: appUrl('/politika-privatnosti') },
  };
}

/** Politika privatnosti (zahtev 6 i 25). */
export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const { document, isFallback } = getPrivacy(locale);

  return (
    <LegalPage
      title={t('nav.privacy')}
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
