import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { PlanForm } from '@/features/admin/plan-form';
import {
  FEATURE_FLAGS,
  FEATURE_LIMITS,
  type FeatureFlag,
  type FeatureLimit,
} from '@/features/billing/entitlements';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { updatePlanAction } from '@/server/actions/admin';
import { listPlans } from '@/server/services/admin';

/**
 * Paketi i limiti (zahtev 7.7 i 39.9).
 *
 * Ovo je jedino mesto na kom se limiti menjaju - nijedna komponenta nema
 * hardkodovanu vrednost, pa izmena ovde odmah važi svuda.
 */
export default async function AdminPlansPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const plans = await listPlans();

  // Nazivi se prevode na serveru: klijentska forma dobija gotove tekstove i ne
  // mora da poznaje prostor imena prevoda.
  const featureLabels = Object.fromEntries(
    FEATURE_FLAGS.map((flag) => [flag, t.dynamic(`billing.features.${flag}`)]),
  ) as Record<FeatureFlag, string>;

  const limitLabels = Object.fromEntries(
    FEATURE_LIMITS.map((limit) => [limit, t.dynamic(`admin.limits.${limit}`)]),
  ) as Record<FeatureLimit, string>;

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        admin: messages.admin,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t('admin.plansTitle')}
          </h1>
        </header>

        <Alert tone="info">{t('admin.plansHint')}</Alert>

        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">
                  {plan.name}{' '}
                  <span className="font-normal text-muted-foreground">({plan.code})</span>
                </CardTitle>
                <Badge variant={plan.isActive ? 'success' : 'neutral'}>
                  {plan.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
                </Badge>
              </CardHeader>
              <CardContent>
                <PlanForm
                  plan={plan}
                  featureLabels={featureLabels}
                  limitLabels={limitLabels}
                  save={updatePlanAction}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TranslationsProvider>
  );
}
