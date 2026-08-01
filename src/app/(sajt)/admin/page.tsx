import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEnv } from '@/lib/env';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { getAdminOverview } from '@/server/services/admin';

/** Zbirni pregled platforme (zahtev 7.5). */
export default async function AdminOverviewPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const overview = await getAdminOverview();

  const cards = [
    { label: t('admin.statUsers'), value: formatNumber(overview.users, locale) },
    { label: t('admin.statEvents'), value: formatNumber(overview.events, locale) },
    {
      label: t('admin.statPublished'),
      value: formatNumber(overview.publishedInvitations, locale),
    },
    {
      label: t('admin.statPaidOrders'),
      value: formatNumber(overview.paidOrders, locale),
    },
    {
      label: t('admin.statPendingOrders'),
      value: formatNumber(overview.pendingOrders, locale),
    },
    {
      label: t('admin.statRevenue'),
      value: formatCurrency(overview.revenueMinor, getEnv().PAYMENT_CURRENCY, locale),
    },
    {
      label: t('admin.statPendingEntries'),
      value: formatNumber(overview.pendingGuestbookEntries, locale),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('admin.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
