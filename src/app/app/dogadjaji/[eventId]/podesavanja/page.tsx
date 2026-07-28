import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteEventCard } from '@/features/events/delete-event-card';
import { EventSettingsForm } from '@/features/events/settings-form';
import { fromInstant } from '@/features/events/schemas';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { getEventDetail } from '@/server/services/events';

/** Podešavanja događaja: osnovni podaci i brisanje. */
export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'event:edit');

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const { date, time } = fromInstant(event.startsAt, event.timeZone);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('settings.title')}
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.generalTitle')}</CardTitle>
          <CardDescription>{t('settings.generalSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <EventSettingsForm
            locale={locale}
            messages={{
              common: messages.common,
              eventFields: messages.eventFields,
              events: messages.events,
              errors: messages.errors,
              validation: messages.validation,
            }}
            detailFields={event.detailFields}
            defaultValues={{
              id: event.id,
              name: event.name,
              details: event.details,
              date,
              time,
              timeZone: event.timeZone,
              city: event.city ?? '',
              venueName: event.venueName ?? '',
              primaryLocale: event.primaryLocale,
              secondaryLocale: event.secondaryLocale,
            }}
          />
        </CardContent>
      </Card>

      {/*
        Brisanje je dostupno samo vlasniku - saradnik sa pravom uređivanja ne sme
        da obriše tuđi događaj (vidi OWNER_ONLY_PERMISSIONS).
      */}
      {access.isOwner ? (
        <DeleteEventCard
          locale={locale}
          messages={{ common: messages.common, events: messages.events, settings: messages.settings }}
          eventId={event.id}
          eventName={event.name}
        />
      ) : null}
    </div>
  );
}
