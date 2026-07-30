import { Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { can } from '@/features/billing/entitlements';
import { PreferenceManager } from '@/features/seating/preference-manager';
import { SeatingEditor } from '@/features/seating/seating-editor';
import { VersionBar } from '@/features/seating/version-bar';
import { WarningsPanel } from '@/features/seating/warnings-panel';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { roleHasPermission } from '@/server/authz/permissions';
import { getUserEntitlements } from '@/server/services/entitlements';
import { getEventDetail } from '@/server/services/events';
import { listGuests } from '@/server/services/guests';
import { getSeatingPlan, listGuestPreferences } from '@/server/services/seating';

/**
 * Raspored sedenja (zahtev 14).
 *
 * Kada paket ne uključuje raspored, stranica se **prikazuje** uz jasnu poruku, a
 * izmene su onemogućene. To je namerno: organizator koji bira paket treba da
 * vidi šta dobija, a lažno uspešna izmena bila bi gora od zaključanog ekrana.
 * Server istu proveru ponavlja u svakoj akciji.
 */
export default async function SeatingPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'seating:view');

  const query = await searchParams;
  const requested = z.uuid().safeParse(
    Array.isArray(query.verzija) ? query.verzija[0] : query.verzija,
  );

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const [plan, entitlements, preferences, guestRows] = await Promise.all([
    getSeatingPlan(eventId, requested.success ? requested.data : undefined),
    getUserEntitlements(access.user.id),
    listGuestPreferences(eventId),
    listGuests(eventId, { odgovor: 'svi', redosled: 'prezime' }),
  ]);

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const hasSeating = can(entitlements, 'seating');
  const canEdit = hasSeating && roleHasPermission(access.role, 'seating:edit');

  const guestOptions = guestRows.map((guest) => ({
    id: guest.id,
    name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
  }));

  const hasGuests = guestRows.length > 0;

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        seating: messages.seating,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t('seating.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('seating.subtitle')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link
                href={`/app/dogadjaji/${eventId}/raspored/izvoz?verzija=${plan.versionId}`}
                prefetch={false}
              >
                <Download aria-hidden />
                {t('seating.exportCsv')}
              </Link>
            </Button>

            <Button asChild variant="secondary">
              <Link
                href={`/app/dogadjaji/${eventId}/raspored/stampa?verzija=${plan.versionId}`}
                target="_blank"
              >
                <Printer aria-hidden />
                {t('seating.printView')}
              </Link>
            </Button>
          </div>
        </header>

        {!hasSeating ? (
          <Alert tone="info" title={t('seating.planLockedTitle')}>
            <p>{t('seating.planLockedText', { plan: entitlements.planName })}</p>
            <p className="mt-2">
              <Link href="/cenovnik" className="font-medium underline underline-offset-4">
                {t('seating.seePlans')}
              </Link>
            </p>
          </Alert>
        ) : null}

        {hasGuests ? (
          <SeatingEditor eventId={eventId} plan={plan} canEdit={canEdit} />
        ) : (
          <EmptyState
            title={t('seating.unseatedTitle')}
            description={t('seating.noGuests')}
            action={
              <Button asChild>
                <Link href={`/app/dogadjaji/${eventId}/gosti`}>
                  {t('seating.openGuests')}
                </Link>
              </Button>
            }
          />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <WarningsPanel warnings={plan.warnings} t={t} />

          <VersionBar
            eventId={eventId}
            versions={plan.versions}
            currentVersionId={plan.versionId}
            isLocked={plan.isLocked}
            canEdit={canEdit}
          />
        </div>

        <PreferenceManager
          eventId={eventId}
          preferences={preferences}
          guests={guestOptions}
          canEdit={canEdit}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('seating.exportTitle')}</CardTitle>
            <CardDescription>{t('seating.exportText')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link
                href={`/app/dogadjaji/${eventId}/raspored/izvoz?verzija=${plan.versionId}`}
                prefetch={false}
              >
                <Download aria-hidden />
                {t('seating.exportCsv')}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link
                href={`/app/dogadjaji/${eventId}/raspored/stampa?verzija=${plan.versionId}`}
                target="_blank"
              >
                <Printer aria-hidden />
                {t('seating.printView')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
}
