import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FEATURE_FLAGS } from '@/features/billing/entitlements';
import { appUrl } from '@/config/brand';
import { formatCurrency } from '@/i18n/format';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { listActivePlans } from '@/server/services/plans';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('pages.pricingTitle'),
    description: t('pages.pricingSubtitle'),
    alternates: { canonical: appUrl('/cenovnik') },
  };
}

/**
 * Cenovnik.
 *
 * Paketi, cene i mogućnosti dolaze iz tabele `feature_plans` - iste one koju
 * čita entitlement sistem. Zbog toga cenovnik ne može da obeća nešto što
 * aplikacija ne dozvoljava (zahtev 18 i 39.9).
 */
export default async function PricingPage() {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const plans = await listActivePlans();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t('pages.pricingTitle')}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t('pages.pricingSubtitle')}
        </p>
      </header>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map((plan, index) => {
          const isHighlighted = index === 1;

          return (
            <section
              key={plan.id}
              aria-labelledby={`paket-${plan.code}`}
              className={cn(
                'relative flex flex-col rounded-[var(--radius-lg)] border bg-surface p-6 shadow-soft',
                isHighlighted ? 'border-primary ring-1 ring-primary/20' : 'border-border',
              )}
            >
              {isHighlighted ? (
                <Badge variant="primary" className="absolute -top-3 left-6">
                  {t('pages.mostPopular')}
                </Badge>
              ) : null}

              <h2 id={`paket-${plan.code}`} className="font-display text-xl font-semibold">
                {plan.name}
              </h2>
              <p className="mt-1.5 min-h-10 text-sm text-muted-foreground">
                {plan.description}
              </p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold">
                  {plan.priceMinor === 0
                    ? t('pages.free')
                    : formatCurrency(plan.priceMinor, plan.currency, locale)}
                </span>
                {plan.priceMinor > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {t('pages.perEvent')}
                  </span>
                ) : null}
              </p>

              <Button
                asChild
                variant={isHighlighted ? 'primary' : 'secondary'}
                className="mt-6 w-full"
              >
                <Link href="/app/dogadjaji/novi">
                  {plan.priceMinor === 0 ? t('pages.startFree') : t('pages.choosePlan')}
                </Link>
              </Button>

              <h3 className="mt-7 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('pages.featuresIncluded')}
              </h3>

              <ul className="mt-3 space-y-2 text-sm">
                {FEATURE_FLAGS.map((flag) => {
                  const enabled = plan.features.flags[flag] === true;

                  return (
                    <li
                      key={flag}
                      className={cn(
                        'flex items-start gap-2',
                        !enabled && 'text-muted-foreground/70',
                      )}
                    >
                      {enabled ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <Minus className="mt-0.5 size-4 shrink-0 opacity-50" aria-hidden />
                      )}
                      <span>{t.dynamic(`features.${flag}`)}</span>
                      {/* Stanje mora biti dostupno i bez oslanjanja na ikonu. */}
                      <span className="sr-only">
                        {enabled ? t('common.yes') : t('common.no')}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('pages.limitsTitle')}
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {(['maxEvents', 'maxPhotos', 'maxGuests'] as const).map((limit) => {
                  const value = plan.features.limits[limit];
                  return (
                    <li key={limit} className="flex items-center justify-between gap-3">
                      <span>{t.dynamic(`limits.${limit}`)}</span>
                      <span className="font-medium text-foreground">
                        {value === null ? '∞' : value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        {t('pages.pricingNote')}
      </p>
    </div>
  );
}
