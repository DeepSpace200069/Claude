import { Download } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { limitFor } from '@/features/billing/entitlements';
import { AddGuestButton } from '@/features/guests/add-guest-button';
import { GuestFiltersBar } from '@/features/guests/guest-filters';
import { GuestTable } from '@/features/guests/guest-table';
import { HouseholdManager } from '@/features/guests/household-manager';
import { ImportGuests } from '@/features/guests/import-guests';
import { guestFiltersSchema } from '@/features/guests/schemas';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { roleHasPermission } from '@/server/authz/permissions';
import { getUserEntitlements } from '@/server/services/entitlements';
import {
  listGuestTags,
  listGuests,
  listHouseholds,
} from '@/server/services/guests';

/**
 * Spisak gostiju (zahtev 12 i 13).
 *
 * Stranica je server komponenta: sav teret čitanja i filtriranja nosi baza, a u
 * pregledač odlazi samo ono što je zaista interaktivno - dijalozi za unos i
 * radnje nad redom.
 *
 * Filteri se čitaju iz URL-a, pa je filtriran spisak deljiv linkom i radi bez
 * JavaScripta.
 */
export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'guests:view');

  const query = await searchParams;
  const filters = guestFiltersSchema.parse({
    pretraga: single(query.pretraga),
    oznaka: single(query.oznaka),
    odgovor: single(query.odgovor) ?? 'svi',
    redosled: single(query.redosled) ?? 'prezime',
  });

  const [guests, households, tags, entitlements] = await Promise.all([
    listGuests(eventId, filters),
    listHouseholds(eventId),
    listGuestTags(eventId),
    getUserEntitlements(access.user.id),
  ]);

  /*
   * Granica paketa se kaže **unapred**, a ne tek kada korisnik popuni formu i
   * klikne „Sačuvaj". Dugmad ostaju vidljiva, jer skrivanje ostavlja korisnika
   * da se pita zašto nešto ne radi - a server istu proveru ionako ponavlja
   * (zahtev 18 i 24).
   */
  const guestLimit = limitFor(entitlements, 'maxGuests');
  const limitReached = guestLimit !== null && guests.length >= guestLimit;

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  // Saradnik sa pravom pregleda vidi spisak, ali ga ne menja. Server istu
  // proveru ponavlja u svakoj akciji - ovo je samo da interfejs ne obećava.
  const canEdit = roleHasPermission(access.role, 'guests:edit');

  const householdOptions = households.map((household) => ({
    id: household.id,
    name: household.name,
  }));

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        guests: messages.guests,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t('guests.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('guests.subtitle')}
            </p>
          </div>

          {canEdit ? (
            <AddGuestButton eventId={eventId} households={householdOptions} />
          ) : null}
        </header>

        {limitReached ? (
          <Alert tone="info" title={t('plans.limitReachedTitle')}>
            <p>
              {t('guests.limitReachedText', {
                plan: entitlements.planName,
                count: guestLimit ?? 0,
              })}
            </p>
            <p className="mt-2">
              <Link href="/cenovnik" className="font-medium underline underline-offset-4">
                {t('publishing.seePlans')}
              </Link>
            </p>
          </Alert>
        ) : null}

        <GuestFiltersBar eventId={eventId} filters={filters} tags={tags} t={t} />

        <section aria-labelledby="spisak-gostiju" className="space-y-3">
          <h2 id="spisak-gostiju" className="text-sm text-muted-foreground">
            {t('guests.countLabel', { count: guests.length })}
          </h2>

          <GuestTable
            eventId={eventId}
            guests={guests}
            households={householdOptions}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('guests.householdsTitle')}</CardTitle>
              <CardDescription>{t('guests.householdsSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <HouseholdManager eventId={eventId} households={households} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {canEdit ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('guests.importTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImportGuests eventId={eventId} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('guests.exportTitle')}</CardTitle>
                <CardDescription>{t('guests.exportText')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href={`/app/dogadjaji/${eventId}/gosti/izvoz`} prefetch={false}>
                    <Download aria-hidden />
                    {t('guests.exportAction')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TranslationsProvider>
  );
}

/** Isti parametar sme da dođe više puta; uzimamo prvi smislen. */
function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim() !== '' ? first : undefined;
}
