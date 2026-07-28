import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/feedback';
import { getFaq } from '@/content/faq';
import { appUrl, brand } from '@/config/brand';
import { LOCALE_META } from '@/i18n/config';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('pages.faqTitle'),
    description: t('pages.faqSubtitle'),
    alternates: { canonical: appUrl('/cesta-pitanja') },
  };
}

/**
 * Česta pitanja.
 *
 * Koristi `<details>`, ne JavaScript: sadržaj je dostupan i pretraživaču i
 * korisniku bez skripte, a otvaranje radi na svakom uređaju (zahtev 22).
 *
 * Dodaje i `FAQPage` structured data - ovo je jedan od retkih slučajeva gde
 * strukturirani podaci stvarno pomažu (zahtev 33).
 */
export default async function FaqPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const { items, isFallback, fallbackLocale } = getFaq(locale);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <script
        type="application/ld+json"
        // Sadržaj je naš, statički i bez korisničkog unosa.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t('pages.faqTitle')}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('pages.faqSubtitle')}</p>
      </header>

      {isFallback ? (
        <Alert tone="info" className="mt-8">
          {t('pages.legalFallbackNotice')} ({LOCALE_META[fallbackLocale].label})
        </Alert>
      ) : null}

      <div className="mt-10 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <details key={item.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {item.question}
              <span
                aria-hidden
                className="shrink-0 text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        {t('pages.faqSubtitle')}{' '}
        <Link href="/kontakt" className="text-primary underline underline-offset-4">
          {brand.supportEmail}
        </Link>
      </p>
    </div>
  );
}
