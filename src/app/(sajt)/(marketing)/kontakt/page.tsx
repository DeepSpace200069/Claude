import { Clock, Mail, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { appUrl, brand } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('pages.contactTitle'),
    description: t('pages.contactSubtitle'),
    alternates: { canonical: appUrl('/kontakt') },
  };
}

/**
 * Kontakt.
 *
 * Namerno bez forme: forma bez servisa iza sebe je lažna funkcionalnost, a
 * slanje poruka kroz aplikaciju dolazi tek uz notification providere (Faza 8).
 * Do tada je `mailto:` iskren i radi svuda.
 */
export default async function ContactPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t('pages.contactTitle')}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t('pages.contactSubtitle')}
        </p>
      </header>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Mail className="size-6" aria-hidden />
        </span>

        <h2 className="mt-5 font-display text-xl font-semibold">
          {t('pages.contactEmail')}
        </h2>

        <a
          href={`mailto:${brand.supportEmail}`}
          className="mt-2 inline-block text-lg text-primary underline underline-offset-4"
        >
          {brand.supportEmail}
        </a>

        <p className="mt-4 text-sm text-muted-foreground">
          {t('pages.contactResponse')}
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        <li className="flex gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold">{t('pages.contactSubtitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.contactResponse')}
            </p>
          </div>
        </li>

        <li className="flex gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold">{t('nav.privacy')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link
                href="/politika-privatnosti"
                className="text-primary underline underline-offset-4"
              >
                {t('nav.privacy')}
              </Link>
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
