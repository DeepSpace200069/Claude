import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildDemoContext } from '@/features/invitations/demo-context';
import { InvitationRenderer } from '@/features/invitations/invitation-renderer';
import { HtmlDemoFrame } from '@/features/templates/html-demo-frame';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { staticParamsOrEmpty } from '@/server/services/build-safe';
import { getTemplateBySlug, listTemplateSlugs } from '@/server/services/templates';

import '@/styles/invitation.css';

type Params = { templateSlug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return staticParamsOrEmpty(async () => {
    const slugs = await listTemplateSlugs();
    return slugs.map((templateSlug) => ({ templateSlug }));
  }, '/demo/[templateSlug]');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { templateSlug } = await params;
  const template = await getTemplateBySlug(templateSlug);
  if (!template) return {};

  return {
    title: template.name,
    description: template.description,
    alternates: { canonical: appUrl(`/demo/${templateSlug}`) },
    // Demo je koristan posetiocu, ali kanonska stranica za pretragu je
    // detaljna stranica šablona - inače bi dve strane takmičile za isti upit.
    robots: { index: false, follow: true },
  };
}

/**
 * Demo šablona preko celog ekrana (zahtev 6).
 *
 * Renderuje se **istom** komponentom kao prava pozivnica, sa `mode: 'preview'`.
 * Zato demo ne može da prikaže nešto što objavljena pozivnica ne bi.
 */
export default async function TemplateDemoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { templateSlug } = await params;
  const template = await getTemplateBySlug(templateSlug);
  if (!template) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const context = buildDemoContext(template.eventTypeKey, template.demoContext);

  const sections = template.sections.map((section, index) => ({
    id: `${template.slug}-${index}`,
    type: section.type,
    schemaVersion: section.schemaVersion,
    position: section.position ?? index,
    isVisible: section.isVisible,
    data: section.data,
  }));

  return (
    <>
      {/* Traka je van `.invitation-root`, pa ne nasleđuje temu pozivnice. */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <Link
          href={`/sabloni/${template.eventTypeSlug}/${template.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {template.name}
        </Link>

        <p className="text-xs text-muted-foreground">{t('templates.demoNote')}</p>

        <Link
          href={`/app/dogadjaji/novi?sablon=${template.slug}`}
          className="inline-flex h-9 items-center rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {t('marketing.heroCta')}
        </Link>
      </div>

      <main id="glavni-sadrzaj">
        {/*
          Uvezen sajt ima svoj dokument, pa se prikazuje kroz okvir. Šablon od
          sekcija se renderuje istom komponentom kao prava pozivnica.
        */}
        {template.kind === 'html' ? (
          <HtmlDemoFrame
            slug={template.slug}
            title={t('templates.demoHtmlFrame')}
            className="h-[calc(100svh-3.5rem)] w-full border-0 bg-white"
          />
        ) : (
          <InvitationRenderer
            sections={sections}
            theme={template.themeTokens}
            locale={locale}
            context={context}
          />
        )}
      </main>
    </>
  );
}
