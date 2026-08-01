import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RoleSelect } from '@/features/admin/admin-controls';
import { formatDate } from '@/i18n/format';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import { setUserRoleAction } from '@/server/actions/admin';
import { listUsers } from '@/server/services/admin';

/**
 * Spisak korisnika (zahtev 7.5).
 *
 * Pretraga ide kroz `GET` obrazac, pa je stanje u URL-u: administrator može da
 * podeli link na tačno isti rezultat i da koristi dugme „nazad”.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdmin();
  const { q } = await searchParams;

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const users = await listUsers({ query: q });

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
            {t('admin.navUsers')}
          </h1>
        </header>

        <form method="get" className="flex flex-wrap gap-2">
          <Input
            name="q"
            defaultValue={q ?? ''}
            aria-label={t('admin.usersSearch')}
            placeholder={t('admin.usersSearch')}
            className="max-w-sm"
          />
          <Button type="submit" variant="secondary">
            {t('admin.usersSearchAction')}
          </Button>
        </form>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.usersEmpty')}</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {user.name ?? user.email}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {user.email}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t('admin.usersEvents', { count: user.eventCount })} ·{' '}
                        {formatDate(user.createdAt, locale)}
                      </span>
                    </span>

                    <RoleSelect
                      userId={user.id}
                      role={user.role}
                      // Sopstvena uloga se ne menja iz panela; server to isto odbija.
                      disabled={user.id === admin.id}
                      setRole={setUserRoleAction}
                    />
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
