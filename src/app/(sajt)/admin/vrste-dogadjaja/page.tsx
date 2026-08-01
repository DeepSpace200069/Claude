import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { AdminActionButton } from '@/features/admin/admin-controls';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { setEventTypeActiveAction } from '@/server/actions/admin';
import { listEventTypes } from '@/server/services/admin';

/** Vrste događaja (zahtev 7.7). */
export default async function AdminEventTypesPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const types = await listEventTypes();

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
            {t('admin.eventTypesTitle')}
          </h1>
        </header>

        <Alert tone="info">{t('admin.eventTypesHint')}</Alert>

        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {types.map((type) => (
                <li
                  key={type.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{t.dynamic(type.labelKey)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {type.key} · {type.slug}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t('admin.eventTypesTemplates', { count: type.templateCount })}
                    </span>
                  </span>

                  <span className="flex items-center gap-3">
                    <Badge variant={type.isActive ? 'success' : 'neutral'}>
                      {type.isActive
                        ? t('admin.statusActive')
                        : t('admin.statusInactive')}
                    </Badge>

                    <AdminActionButton
                      label={
                        type.isActive
                          ? t('admin.eventTypesDisable')
                          : t('admin.eventTypesEnable')
                      }
                      successMessage={t('admin.eventTypesChanged')}
                      input={{ eventTypeId: type.id, isActive: !type.isActive }}
                      action={setEventTypeActiveAction}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
}
