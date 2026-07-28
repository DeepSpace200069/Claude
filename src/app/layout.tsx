import type { Metadata, Viewport } from 'next';

import { Toaster } from '@/components/ui/toaster';
import { brand, appUrl } from '@/config/brand';
import { LOCALE_META } from '@/i18n/config';
import { getRequestLocale, getTranslations } from '@/i18n/server';

import '@/styles/globals.css';

/**
 * Korenski layout.
 *
 * Jezik se određuje po zahtevu (kolačić -> Accept-Language), pa `<html lang>`
 * uvek odgovara sadržaju - to je preduslov i za čitače ekrana i za ispravno
 * deljenje reči u pregledaču.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return {
    metadataBase: new URL(appUrl()),
    title: {
      default: `${brand.name} · ${t('brand.tagline')}`,
      template: `%s · ${brand.name}`,
    },
    description: t('brand.description'),
    applicationName: brand.name,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: `${brand.name} · ${t('brand.tagline')}`,
      description: t('brand.description'),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  return (
    <html lang={LOCALE_META[locale].htmlLang} dir={LOCALE_META[locale].dir}>
      <body className="min-h-dvh antialiased">
        {/* Prečica za korisnike tastature (WCAG 2.4.1). */}
        <a
          href="#glavni-sadrzaj"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lifted"
        >
          {t('nav.skipToContent')}
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
