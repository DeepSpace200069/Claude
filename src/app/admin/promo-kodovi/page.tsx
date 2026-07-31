import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminActionButton } from '@/features/admin/admin-controls';
import { PromoForm } from '@/features/admin/promo-form';
import { formatDate } from '@/i18n/format';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import {
  createPromoCodeAction,
  setPromoCodeActiveAction,
} from '@/server/actions/admin';
import { listPromoCodes } from '@/server/services/admin';

/** Promo kodovi i besplatne aktivacije (zahtev 7.3). */
export default async function AdminPromoPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const codes = await listPromoCodes();

  const kindLabels = {
    percent: t('admin.promoKindPercent'),
    fixed: t('admin.promoKindFixed'),
    free: t('admin.promoKindFree'),
  };

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
            {t('admin.promoTitle')}
          </h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.promoCreate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PromoForm create={createPromoCodeAction} />
          </CardContent>
        </Card>

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.promoEmpty')}</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {codes.map((promo) => (
                  <li
                    key={promo.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{promo.code}</span>
                      <span className="block text-sm text-muted-foreground">
                        {kindLabels[promo.kind]}
                        {promo.kind === 'free' ? '' : ` · ${promo.value}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t('admin.promoUsed', { used: promo.redemptions })}
                        {promo.maxRedemptions === null ? '' : ` / ${promo.maxRedemptions}`}
                        {promo.validUntil
                          ? ` · ${formatDate(promo.validUntil, locale)}`
                          : ''}
                      </span>
                    </span>

                    <span className="flex items-center gap-3">
                      <Badge variant={promo.isActive ? 'success' : 'neutral'}>
                        {promo.isActive
                          ? t('admin.statusActive')
                          : t('admin.statusInactive')}
                      </Badge>

                      <AdminActionButton
                        label={
                          promo.isActive
                            ? t('admin.promoDeactivate')
                            : t('admin.promoActivate')
                        }
                        successMessage={t('common.saved')}
                        input={{ promoCodeId: promo.id, isActive: !promo.isActive }}
                        action={setPromoCodeActiveAction}
                      />
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
