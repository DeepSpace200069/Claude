import type { Metadata, Viewport } from 'next';

import { appUrl, brand } from '@/config/brand';
import { Toaster } from '@/components/ui/toaster';
import { ConsentBanner } from '@/features/consent/consent-banner';
import { renderTemplateDocument } from '@/features/invitations/html-document';
import { LOCALE_META } from '@/i18n/config';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { getPublicInvitation } from '@/server/services/public-invitation';

import '@/styles/globals.css';

/**
 * Korenski layout javne pozivnice (zahtev 39.4).
 *
 * Pozivnica ima **svoj** dokument, odvojen od ostatka aplikacije. Razlog je
 * jedna vrsta šablona: uvezen gotov sajt donosi sopstveni `<html>`, svoje
 * stilove i svoj reset, pa bi ga naš `globals.css` (Tailwind reset) pregazio -
 * a upravo je izgled ono zbog čega takav šablon i postoji.
 *
 * Podela na dva korenska layout-a ima i drugu korist: Next između njih radi
 * **tvrdu** navigaciju. Zahvaljujući tome pozivnica se uvek dobija kao svež
 * HTML koji pregledač parsira, pa se skripte šablona izvršavaju - da se sadržaj
 * menjao unutar iste stranice, nijedna se ne bi pokrenula.
 *
 * Pozivnica od sekcija ide kroz drugu granu i dobija isti okvir kao do sada.
 */
/**
 * `metadataBase` mora da stoji i ovde.
 *
 * Pozivnica ima svoj korenski layout, pa ne nasleđuje ništa od layout-a
 * aplikacije. Bez ovoga bi se relativne adrese - pre svega generisana slika za
 * karticu deljenja - razrešavale prema `localhost`, i link poslat u poruci ne bi
 * imao sliku (zahtev 16).
 */
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(appUrl()),
    title: { default: brand.name, template: `%s · ${brand.name}` },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function InvitationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const invitation = await getPublicInvitation(publicSlug);

  const parts =
    invitation?.html?.status === 'ok'
      ? renderTemplateDocument({
          ...invitation.html,
          mediaUrl: (assetId) => invitation.context.media[assetId]?.url ?? null,
        })
      : null;

  if (parts) {
    /*
     * Atributi `<html>` i `<body>` iz šablona se prenose kakvi jesu: u njima su
     * jezik autora i klase na kojima često visi ceo njegov CSS (`body.tamna`).
     * Sadržaj `<head>`-a ide na početak tela - `<link>`, `<style>` i `<script>`
     * rade i odatle, a pravi `<head>` popunjava Next svojim metapodacima.
     */
    return (
      <html {...parts.htmlAttributes}>
        <body {...parts.bodyAttributes}>
          <div hidden dangerouslySetInnerHTML={{ __html: parts.headHtml }} />
          {children}
        </body>
      </html>
    );
  }

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
        {/*
          Traka je klijentska i čita kolačić u pregledaču, pa keširane rute
          ostaju keširane. Prikazuje se samo dok odluka ne postoji.
        */}
        <ConsentBanner
          labels={{
            title: t('cookies.bannerTitle'),
            text: t('cookies.bannerText'),
            acceptAll: t('cookies.bannerAcceptAll'),
            necessaryOnly: t('cookies.bannerNecessaryOnly'),
            more: t('cookies.bannerMore'),
          }}
        />
      </body>
    </html>
  );
}
