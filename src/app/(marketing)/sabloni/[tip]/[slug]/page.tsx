import { ArrowLeft, Check, Palette, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { DevicePreview } from '@/features/templates/device-preview';
import { InvitationRenderer } from '@/features/invitations/invitation-renderer';
import { buildDemoContext } from '@/features/invitations/demo-context';
import { getSectionDefinition } from '@/features/sections/registry';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { staticParamsOrEmpty } from '@/server/services/build-safe';
import { getTemplateBySlug, listTemplates } from '@/server/services/templates';

import '@/styles/invitation.css';

type Params = { tip: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return staticParamsOrEmpty(async () => {
    const items = await listTemplates();
    return items.map((template) => ({
      tip: template.eventTypeSlug,
      slug: template.slug,
    }));
  }, '/sabloni/[tip]/[slug]');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tip, slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) return {};

  const canonical = appUrl(`/sabloni/${tip}/${slug}`);

  return {
    title: template.name,
    description: template.description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: template.name,
      description: template.description,
      url: canonical,
    },
  };
}

/** Detaljna stranica šablona sa uživo prikazom na tri veličine ekrana. */
export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tip, slug } = await params;
  const template = await getTemplateBySlug(slug);

  // Šablon mora da odgovara vrsti proslave iz putanje: inače bi isti sadržaj
  // bio dostupan na više URL-ova, što je loše i za korisnika i za SEO.
  if (!template || template.eventTypeSlug !== tip) notFound();

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

  const sectionLabels = template.sections
    .map((section) => getSectionDefinition(section.type))
    .filter((definition) => definition !== undefined)
    .map((definition) => t.dynamic(definition.labelKey));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href={`/sabloni/${tip}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('templates.backToGallery')}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="order-2 lg:order-1">
          <DevicePreview
            labels={{
              phone: t('templates.devicePhone'),
              tablet: t('templates.deviceTablet'),
              desktop: t('templates.deviceDesktop'),
              fullscreen: t('templates.openFullscreen'),
            }}
            fullscreenHref={`/demo/${template.slug}`}
          >
            <InvitationRenderer
              sections={sections}
              theme={template.themeTokens}
              locale={locale}
              context={context}
            />
          </DevicePreview>
        </div>

        <aside className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{t.dynamic(template.eventTypeLabelKey)}</Badge>
              {template.isFeatured ? (
                <Badge variant="neutral">
                  <Sparkles className="size-3" aria-hidden />
                  {t('templates.featured')}
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              {template.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {template.description}
            </p>
          </div>

          <Button asChild size="lg" className="w-full">
            <Link href={`/app/dogadjaji/novi?sablon=${template.slug}`}>
              {t('templates.useTemplate')}
            </Link>
          </Button>

          {template.requiredPlanCode !== 'free' ? (
            <Alert tone="info">
              {t('templates.availableIn', {
                plan: t.dynamic(`plans.${template.requiredPlanCode}`),
              })}
            </Alert>
          ) : null}

          <dl className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('templates.style')}</dt>
              <dd className="font-medium">
                {t.dynamic(`templateStyles.${template.style}`)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('templates.color')}</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span
                  aria-hidden
                  className="size-4 rounded-full border border-border"
                  style={{ backgroundColor: template.dominantColor }}
                />
                <Palette className="size-3.5 text-muted-foreground" aria-hidden />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('templates.filterPhotos')}</dt>
              <dd className="font-medium">
                {template.usesPhotos ? t('common.yes') : t('common.no')}
              </dd>
            </div>
          </dl>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-semibold">{t('templates.includedSections')}</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {sectionLabels.map((label, labelIndex) => (
                <li key={`${label}-${labelIndex}`} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">{t('templates.demoNote')}</p>
        </aside>
      </div>
    </div>
  );
}
