import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { FEATURE_FLAGS, can } from '@/features/billing/entitlements';
import { CheckoutPanel, type PurchasablePlan } from '@/features/billing/checkout-panel';
import { formatCurrency, formatDateTime } from '@/i18n/format';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { startCheckoutAction } from '@/server/actions/billing';
import { listOrdersForEvent } from '@/server/services/billing';
import { getEventEntitlements } from '@/server/services/entitlements';
import { getEventDetail } from '@/server/services/events';
import { listActivePlans } from '@/server/services/plans';

/**
 * Plan i naplata za jednu pozivnicu (zahtev 17 i 7.4).
 *
 * Paket se kupuje **po pozivnici**, pa je ova stranica u kontekstu događaja, a
 * ne naloga: prikazuje šta važi za ovaj događaj, šta se dobija nadogradnjom i
 * spisak dosadašnjih narudžbina baš za njega.
 */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ naplata?: string }>;
}) {
  const { eventId } = await params;
  const { naplata } = await searchParams;

  // Naplata je vlasničko pravo: saradnik uređuje pozivnicu, ali ne troši tuđ novac.
  await requireEventPageAccess(eventId, 'billing:manage');

  const [event, entitlements, plans, orders] = await Promise.all([
    getEventDetail(eventId),
    getEventEntitlements(eventId),
    listActivePlans(),
    listOrdersForEvent(eventId),
  ]);

  if (!event) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const purchasable: PurchasablePlan[] = plans.map((plan) => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price:
      plan.priceMinor > 0
        ? formatCurrency(plan.priceMinor, plan.currency, locale)
        : t('billing.freePrice'),
    // Mogućnosti se čitaju iz samog paketa, pa spisak ne može da obeća nešto
    // što entitlement sistem ne dozvoljava.
    highlights: FEATURE_FLAGS.filter((flag) => plan.features.flags[flag]).map((flag) =>
      t.dynamic(`billing.features.${flag}`),
    ),
    isCurrent: plan.code === entitlements.planCode,
    isPurchasable: plan.priceMinor > 0 && plan.code !== entitlements.planCode,
  }));

  const statusLabels: Record<string, string> = {
    pending: t('billing.orderPending'),
    paid: t('billing.orderPaid'),
    failed: t('billing.orderFailed'),
    canceled: t('billing.orderCanceled'),
    refunded: t('billing.orderRefunded'),
  };

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        billing: messages.billing,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('billing.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('billing.subtitle', { event: event.name })}
          </p>
        </header>

        {naplata === 'povratak' ? (
          <Alert tone="info" title={t('billing.returnTitle')}>
            {t('billing.returnText')}
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{t('billing.currentTitle')}</CardTitle>
            <Badge variant={can(entitlements, 'publish') ? 'success' : 'warning'}>
              {entitlements.planName}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {can(entitlements, 'publish')
                ? t('billing.currentIncludesPublish')
                : t('billing.currentNoPublish')}
            </p>
            <p className="text-sm">
              <Link
                href={`/app/dogadjaji/${eventId}/objavljivanje`}
                className="font-medium underline underline-offset-4"
              >
                {t('billing.goToPublishing')}
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('billing.upgradeTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckoutPanel
              eventId={eventId}
              plans={purchasable}
              startCheckout={startCheckoutAction}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('billing.historyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('billing.historyEmpty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{order.planName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt, locale, {
                          timeZone: event.timeZone,
                        })}
                        {order.promoCode ? ` · ${order.promoCode}` : ''}
                      </span>
                    </span>

                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">
                        {formatCurrency(order.totalMinor, order.currency, locale)}
                      </span>
                      <Badge
                        variant={
                          order.status === 'paid'
                            ? 'success'
                            : order.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {statusLabels[order.status] ?? order.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
}
