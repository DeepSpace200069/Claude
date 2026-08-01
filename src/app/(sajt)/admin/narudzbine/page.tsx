import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ActivateOrderDialog } from '@/features/admin/admin-controls';
import { formatCurrency, formatDateTime } from '@/i18n/format';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { activateOrderAction } from '@/server/actions/admin';
import { listOrders, type AdminOrderRow } from '@/server/services/admin';

const STATUSES = ['pending', 'paid', 'failed', 'canceled', 'refunded'] as const;

function isStatus(value: string | undefined): value is AdminOrderRow['status'] {
  return Boolean(value) && (STATUSES as readonly string[]).includes(value as string);
}

/**
 * Narudžbine i ručna aktivacija (zahtev 7.5 i 7.3).
 *
 * Ručna aktivacija je jedini put kojim narudžbina postaje plaćena bez
 * provajdera - zato traži razlog i ostavlja zapis u audit logu.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const orders = await listOrders({ status: isStatus(status) ? status : undefined });

  const statusLabels: Record<AdminOrderRow['status'], string> = {
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
        admin: messages.admin,
        common: messages.common,
        errors: messages.errors,
      }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t('admin.navOrders')}
          </h1>
        </header>

        <nav className="flex flex-wrap gap-2" aria-label={t('admin.navOrders')}>
          <Link
            href="/admin/narudzbine"
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t('admin.ordersAll')}
          </Link>
          {STATUSES.map((value) => (
            <Link
              key={value}
              href={`/admin/narudzbine?status=${value}`}
              className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {statusLabels[value]}
            </Link>
          ))}
        </nav>

        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.ordersEmpty')}</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {order.eventName ?? t('admin.ordersNoEvent')}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {order.userEmail} · {order.planName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt, locale)}
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-3">
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
                        {statusLabels[order.status]}
                      </Badge>

                      {order.status === 'pending' ? (
                        <ActivateOrderDialog
                          orderId={order.id}
                          activate={activateOrderAction}
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </TranslationsProvider>
  );
}
