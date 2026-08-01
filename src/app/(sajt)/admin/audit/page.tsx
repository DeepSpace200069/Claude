import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/i18n/format';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { listAuditLog } from '@/server/services/audit';

/**
 * Pregled audit loga (zahtev 7.8 i 24).
 *
 * Samo čitanje: zapisi se ne menjaju i ne brišu, pa ovde nema nijedne akcije.
 */
export default async function AdminAuditPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const entries = await listAuditLog({ limit: 200 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('admin.auditTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.auditHint')}</p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.auditEmpty')}</p>
      ) : (
        <Card>
          <CardContent
            className="overflow-x-auto p-0"
            tabIndex={0}
            role="region"
            aria-label={t('admin.auditTitle')}
          >
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.auditWhen')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.auditActor')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.auditAction')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('admin.auditEntity')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(entry.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.actorEmail ?? t('admin.auditSystem')}
                    </td>
                    <td className="px-4 py-3 font-medium">{entry.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
