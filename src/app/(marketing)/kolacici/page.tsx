import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STORAGE_INVENTORY } from '@/features/consent/consent';
import { ConsentSettings } from '@/features/consent/consent-settings';
import { appUrl } from '@/config/brand';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('cookies.title'),
    description: t('cookies.subtitle'),
    alternates: { canonical: appUrl('/kolacici') },
  };
}

/**
 * Kolačići i čuvanje u pregledaču (zahtev 29).
 *
 * Tabela se pravi iz `STORAGE_INVENTORY`, istog spiska po kom se ponaša i sam
 * kod - opis pisan zasebno zastari prvog dana kada neko doda kolačić.
 */
export default async function CookiesPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const necessary = STORAGE_INVENTORY.filter((item) => item.category === 'neophodno');
  const measurement = STORAGE_INVENTORY.filter((item) => item.category === 'merenje');

  const table = (items: typeof STORAGE_INVENTORY) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('cookies.columnName')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('cookies.columnKind')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('cookies.columnPurpose')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('cookies.columnDuration')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.name}>
              <td className="py-2 pe-3 font-mono text-xs">{item.name}</td>
              <td className="py-2 pe-3 text-muted-foreground">{item.kind}</td>
              <td className="py-2 pe-3">{t.dynamic(item.purposeKey)}</td>
              <td className="py-2 text-muted-foreground">{item.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('cookies.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('cookies.subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('cookies.choiceTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TranslationsProvider
            locale={locale}
            messages={{ cookies: messages.cookies, common: messages.common }}
          >
            <ConsentSettings />
          </TranslationsProvider>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          {t('cookies.necessaryTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('cookies.necessaryText')}</p>
        {table(necessary)}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          {t('cookies.measurementTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('cookies.measurementText')}</p>
        {table(measurement)}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          {t('cookies.noTrackingTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('cookies.noTrackingText')}</p>
      </section>
    </div>
  );
}
