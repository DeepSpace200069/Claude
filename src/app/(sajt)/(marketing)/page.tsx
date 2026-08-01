import {
  ArrowRight,
  CalendarHeart,
  ClipboardCheck,
  Layers,
  Link2,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { listActiveEventTypes } from '@/server/services/catalog';

/**
 * Početna stranica.
 *
 * Sav tekst dolazi iz kataloga prevoda, a kategorije proslava iz baze - kada
 * administrator doda novu vrstu događaja, ona se ovde pojavi bez izmene koda.
 */
export default async function HomePage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const eventTypes = await listActiveEventTypes();

  const steps = [
    { title: t('marketing.step1Title'), text: t('marketing.step1Text') },
    { title: t('marketing.step2Title'), text: t('marketing.step2Text') },
    { title: t('marketing.step3Title'), text: t('marketing.step3Text') },
  ];

  const features = [
    {
      icon: Layers,
      title: t('marketing.featureBuilderTitle'),
      text: t('marketing.featureBuilderText'),
    },
    {
      icon: ClipboardCheck,
      title: t('marketing.featureRsvpTitle'),
      text: t('marketing.featureRsvpText'),
    },
    {
      icon: CalendarHeart,
      title: t('marketing.featureSeatingTitle'),
      text: t('marketing.featureSeatingText'),
    },
    {
      icon: Link2,
      title: t('marketing.featureLinkTitle'),
      text: t('marketing.featureLinkText'),
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_50%,var(--color-primary-subtle),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <Badge variant="primary" className="animate-fade-in">
            {t('brand.tagline')}
          </Badge>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            {t('marketing.heroTitle')}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t('marketing.heroSubtitle')}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/app/dogadjaji/novi">
                {t('marketing.heroCta')}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/sabloni">{t('marketing.heroSecondaryCta')}</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t('marketing.heroNote')}
          </p>
        </div>
      </section>

      {/* Kategorije */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {t('marketing.categoriesTitle')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t('marketing.categoriesSubtitle')}
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {eventTypes.map((eventType) => (
            <li key={eventType.id}>
              <Link
                href={`/sabloni/${eventType.slug}`}
                className="group flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <span className="font-display text-lg font-medium">
                  {t.dynamic(eventType.labelKey)}
                </span>
                <span className="mt-6 inline-flex items-center gap-1 text-sm text-primary">
                  {t('common.preview')}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Koraci */}
      <section className="border-y border-border bg-surface/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              {t('marketing.stepsTitle')}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t('marketing.stepsSubtitle')}
            </p>
          </div>

          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                {/*
                  `primary-subtle` je token **pozadine**; kao boja teksta daje
                  broj koji se praktično ne vidi. Broj koraka je deo poruke, pa
                  mora da bude čitljiv.
                */}
                <span className="font-display text-5xl font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Mogućnosti */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="mb-10 max-w-2xl font-display text-3xl font-semibold tracking-tight">
          {t('marketing.featuresTitle')}
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex gap-4 p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Poziv na akciju */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="rounded-[var(--radius-2xl)] border border-border bg-[linear-gradient(135deg,var(--color-primary-subtle),transparent_70%)] px-6 py-14 text-center shadow-soft sm:px-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('marketing.finalCtaTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t('marketing.finalCtaText')}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/app/dogadjaji/novi">
              {t('marketing.heroCta')}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
