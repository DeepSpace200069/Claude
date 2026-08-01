import {
  ArrowRight,
  ClipboardCheck,
  LayoutGrid,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { appUrl } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('pages.howItWorksTitle'),
    description: t('pages.howItWorksSubtitle'),
    alternates: { canonical: appUrl('/kako-funkcionise') },
  };
}

/** „Kako funkcioniše" - pet koraka od ideje do praćenja odgovora (zahtev 6). */
export default async function HowItWorksPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const steps = [
    {
      icon: Sparkles,
      title: t('marketing.step1Title'),
      text: t('marketing.step1Text'),
    },
    {
      icon: LayoutGrid,
      title: t('wizard.step3Title'),
      text: t('wizard.step3Subtitle'),
    },
    {
      icon: SlidersHorizontal,
      title: t('marketing.step2Title'),
      text: t('marketing.step2Text'),
    },
    {
      icon: Send,
      title: t('marketing.step3Title'),
      text: t('marketing.step3Text'),
    },
    {
      icon: ClipboardCheck,
      title: t('marketing.featureRsvpTitle'),
      text: t('marketing.featureRsvpText'),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t('pages.howItWorksTitle')}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t('pages.howItWorksSubtitle')}
        </p>
      </header>

      <ol className="mt-14 space-y-10">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-5">
            {/* Linija koja povezuje korake; poslednji je nema. */}
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-6 top-14 h-[calc(100%+0.5rem)] w-px bg-border"
              />
            ) : null}

            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <step.icon className="size-5" aria-hidden />
            </span>

            <div className="pt-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">
                {step.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 rounded-[var(--radius-2xl)] border border-border bg-[linear-gradient(135deg,var(--color-primary-subtle),transparent_70%)] px-6 py-12 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {t('marketing.finalCtaTitle')}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t('marketing.heroNote')}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      </div>
    </div>
  );
}
