import { LayoutGrid } from 'lucide-react';

import { EmptyState } from '@/components/ui/feedback';
import { GalleryFilters } from '@/features/templates/gallery-filters';
import { FavoritesGate } from '@/features/templates/favorites-gate';
import { TemplateCard } from '@/features/templates/template-card';
import { getTranslations } from '@/i18n/server';
import type { Locale } from '@/i18n/config';
import {
  getTemplateFacets,
  listTemplates,
  type TemplateFilters,
} from '@/server/services/templates';

/**
 * Galerija šablona.
 *
 * Ista komponenta služi i `/sabloni` i `/sabloni/[tip]` - razlika je samo u
 * `eventTypeSlug` filteru i osnovnoj putanji za linkove filtera.
 */
export async function TemplateGallery({
  locale,
  basePath,
  searchParams,
  eventTypeSlug,
}: {
  locale: Locale;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  eventTypeSlug?: string;
}) {
  const t = await getTranslations(locale);

  const single = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters: TemplateFilters = {
    ...(eventTypeSlug ? { eventTypeSlug } : {}),
    ...(single('stil') ? { style: single('stil') } : {}),
    ...(single('boja') ? { colorGroup: single('boja') } : {}),
    ...(single('fotografije') === 'da'
      ? { usesPhotos: true }
      : single('fotografije') === 'ne'
        ? { usesPhotos: false }
        : {}),
    ...(single('redosled') === 'najnoviji'
      ? { sort: 'najnoviji' as const }
      : single('redosled') === 'naziv'
        ? { sort: 'naziv' as const }
        : {}),
  };

  const [items, facets] = await Promise.all([
    listTemplates(filters),
    getTemplateFacets(),
  ]);

  const filtersBar = (
    <GalleryFilters
      basePath={basePath}
      styles={facets.styles.map((facet) => ({
        value: facet.value,
        label: t.dynamic(`templateStyles.${facet.value}`),
        count: facet.count,
      }))}
      colorGroups={facets.colorGroups.map((facet) => ({
        value: facet.value,
        label: t.dynamic(`templateColors.${facet.value}`),
        count: facet.count,
      }))}
      labels={{
        style: t('templates.filterStyle'),
        color: t('templates.filterColor'),
        photos: t('templates.filterPhotos'),
        photosAny: t('common.all'),
        photosWith: t('templates.photosWith'),
        photosWithout: t('templates.photosWithout'),
        sort: t('templates.sort'),
        sortRecommended: t('templates.sortRecommended'),
        sortNewest: t('templates.sortNewest'),
        sortName: t('templates.sortName'),
        all: t('common.all'),
        apply: t('templates.applyFilters'),
        clear: t('templates.clearFilters'),
      }}
    />
  );

  return (
    <div className="space-y-6">
      <FavoritesGate
        filters={filtersBar}
        labels={{
          onlyFavorites: t('templates.onlyFavorites'),
          emptyFavorites: t('templates.emptyFavorites'),
        }}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="size-6" aria-hidden />}
            title={t('templates.emptyTitle')}
            description={t('templates.emptyText')}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
              {t('templates.countLabel', { count: items.length })}
            </p>

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((template) => (
                <li key={template.id} data-template-slug={template.slug}>
                  <TemplateCard
                    template={template}
                    labels={{
                      preview: t('templates.preview'),
                      featured: t('templates.featured'),
                      withPhotos: t('templates.withPhotos'),
                      typeLabel: t.dynamic(template.eventTypeLabelKey),
                      planLabel:
                        template.requiredPlanCode === 'free'
                          ? null
                          : t.dynamic(`plans.${template.requiredPlanCode}`),
                      favoriteAdd: t('templates.favoriteAdd'),
                      favoriteRemove: t('templates.favoriteRemove'),
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </FavoritesGate>
    </div>
  );
}
