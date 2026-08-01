import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { TemplateGallery } from '@/features/templates/template-gallery';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { listActiveEventTypes } from '@/server/services/catalog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return {
    title: t('templates.title'),
    description: t('templates.subtitle'),
    alternates: { canonical: appUrl('/sabloni') },
    openGraph: {
      title: t('templates.title'),
      description: t('templates.subtitle'),
      url: appUrl('/sabloni'),
    },
  };
}

/** Galerija svih šablona sa filterima (zahtev 6 i 7). */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const params = await searchParams;
  const eventTypes = await listActiveEventTypes();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t('templates.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('templates.subtitle')}</p>
      </header>

      {/* Prečice po vrsti proslave; aktivna je „sve" jer smo na opštoj galeriji. */}
      <nav aria-label={t('marketing.categoriesTitle')} className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge variant="primary" className="px-3.5 py-1.5">
              {t('common.all')}
            </Badge>
          </li>
          {eventTypes.map((eventType) => (
            <li key={eventType.id}>
              <Link
                href={`/sabloni/${eventType.slug}`}
                className="inline-flex rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {t.dynamic(eventType.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <TemplateGallery locale={locale} basePath="/sabloni" searchParams={params} />
    </div>
  );
}
