import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { TemplateGallery } from '@/features/templates/template-gallery';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { staticParamsOrEmpty } from '@/server/services/build-safe';
import { getEventTypeBySlug, listActiveEventTypes } from '@/server/services/catalog';

type Params = { tip: string };

/**
 * Slugovi vrsta proslava se ne menjaju često, pa ih generišemo unapred - prva
 * poseta ne čeka upit ka bazi.
 */
export async function generateStaticParams(): Promise<Params[]> {
  return staticParamsOrEmpty(async () => {
    const eventTypes = await listActiveEventTypes();
    return eventTypes.map((eventType) => ({ tip: eventType.slug }));
  }, '/sabloni/[tip]');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tip } = await params;
  const eventType = await getEventTypeBySlug(tip);
  if (!eventType) return {};

  const t = await getTranslations();
  const label = t.dynamic(eventType.labelKey);
  const title = `${label} — ${t('templates.title').toLowerCase()}`;

  return {
    title,
    description: t('templates.subtitle'),
    alternates: { canonical: appUrl(`/sabloni/${tip}`) },
    openGraph: { title, description: t('templates.subtitle'), url: appUrl(`/sabloni/${tip}`) },
  };
}

/** Galerija filtrirana po vrsti proslave. */
export default async function TemplatesByTypePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tip } = await params;
  const eventType = await getEventTypeBySlug(tip);
  if (!eventType) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const search = await searchParams;
  const eventTypes = await listActiveEventTypes();
  const label = t.dynamic(eventType.labelKey);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{label}</h1>
        <p className="mt-2 text-muted-foreground">{t('templates.subtitle')}</p>
      </header>

      <nav aria-label={t('marketing.categoriesTitle')} className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/sabloni"
              className="inline-flex rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {t('common.all')}
            </Link>
          </li>
          {eventTypes.map((item) =>
            item.slug === tip ? (
              <li key={item.id}>
                <Badge variant="primary" className="px-3.5 py-1.5">
                  {t.dynamic(item.labelKey)}
                </Badge>
              </li>
            ) : (
              <li key={item.id}>
                <Link
                  href={`/sabloni/${item.slug}`}
                  className="inline-flex rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  {t.dynamic(item.labelKey)}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      <TemplateGallery
        locale={locale}
        basePath={`/sabloni/${tip}`}
        searchParams={search}
        eventTypeSlug={tip}
      />
    </div>
  );
}
