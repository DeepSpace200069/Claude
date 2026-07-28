import { CalendarPlus, PartyPopper } from 'lucide-react';
import Link from 'next/link';

import { EventCard } from '@/features/events/event-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { daysUntil, formatDate } from '@/i18n/format';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireUserPage } from '@/server/authz/page-guards';
import { listEventsForUser } from '@/server/services/events';

/** Lista svih događaja prijavljenog korisnika. */
export default async function EventsPage() {
  const user = await requireUserPage('/app/dogadjaji');
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const events = await listEventsForUser(user.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('events.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length > 0
              ? t('events.countLabel', { count: events.length })
              : t('events.subtitle')}
          </p>
        </div>

        <Button asChild>
          <Link href="/app/dogadjaji/novi">
            <CalendarPlus aria-hidden />
            {t('events.createButton')}
          </Link>
        </Button>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={<PartyPopper className="size-6" aria-hidden />}
          title={t('events.emptyTitle')}
          description={t('events.emptyText')}
          action={
            <Button asChild size="lg">
              <Link href="/app/dogadjaji/novi">{t('events.emptyCta')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const remaining = event.startsAt
              ? daysUntil(event.startsAt, new Date(), event.timeZone)
              : null;

            return (
              <li key={event.id}>
                <EventCard
                  id={event.id}
                  name={event.name}
                  city={event.city}
                  typeLabel={t.dynamic(event.eventTypeLabelKey)}
                  statusLabel={t.dynamic(`eventStatus.${event.status}`)}
                  status={event.status}
                  dateLabel={
                    event.startsAt
                      ? formatDate(event.startsAt, locale, {
                          timeZone: event.timeZone,
                        })
                      : null
                  }
                  countdownLabel={
                    remaining === null
                      ? null
                      : remaining > 0
                        ? t('dashboard.daysLeft', { count: remaining })
                        : remaining === 0
                          ? t('dashboard.today')
                          : t('dashboard.past')
                  }
                  openLabel={t('events.openDashboard')}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
