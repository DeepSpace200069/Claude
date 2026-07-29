import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Send,
  Settings,
  SquarePen,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { appUrl } from '@/config/brand';
import { daysUntil, formatDateTime } from '@/i18n/format';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { getEventDetail, getEventStats } from '@/server/services/events';

/**
 * Kontrolni panel jednog događaja (zahtev 15).
 *
 * Pristup se proverava pre bilo kakvog čitanja: `requireEventPageAccess` vraća
 * 404 i za tuđe događaje, pa se postojanje tuđeg događaja ne može
 * zaključiti iz odgovora.
 */
export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireEventPageAccess(eventId, 'event:view');

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const stats = await getEventStats(eventId);

  const remaining = event.startsAt
    ? daysUntil(event.startsAt, new Date(), event.timeZone)
    : null;

  const statCards = [
    { label: t('dashboard.views'), value: stats.views },
    { label: t('dashboard.responses'), value: stats.responses },
    { label: t('dashboard.confirmed'), value: stats.confirmed },
    { label: t('dashboard.adults'), value: stats.adults },
    { label: t('dashboard.children'), value: stats.children },
    { label: t('dashboard.pending'), value: stats.pending },
  ];

  const shortcuts = [
    {
      href: `/app/dogadjaji/${eventId}/editor`,
      label: t('dashboard.openEditor'),
      icon: SquarePen,
    },
    {
      href: `/app/dogadjaji/${eventId}/gosti`,
      label: t('dashboard.openGuests'),
      icon: Users,
    },
    {
      href: `/app/dogadjaji/${eventId}/objavljivanje`,
      label: t('publishing.title'),
      icon: Send,
    },
    {
      href: `/app/dogadjaji/${eventId}/podesavanja`,
      label: t('dashboard.openSettings'),
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{t.dynamic(event.eventTypeLabelKey)}</Badge>
            <Badge
              variant={event.invitationStatus === 'published' ? 'success' : 'warning'}
            >
              {t.dynamic(
                `eventStatus.${event.invitationStatus === 'published' ? 'published' : 'draft'}`,
              )}
            </Badge>
          </div>

          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            {event.name}
          </h1>

          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {event.startsAt ? (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                <dd>
                  {formatDateTime(event.startsAt, locale, {
                    timeZone: event.timeZone,
                  })}
                </dd>
              </div>
            ) : null}
            {event.city ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                <dd>{event.city}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {remaining !== null ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-5 py-4 text-center shadow-soft">
            <p className="font-display text-2xl font-semibold">
              {remaining > 0
                ? t('dashboard.daysLeft', { count: remaining })
                : remaining === 0
                  ? t('dashboard.today')
                  : t('dashboard.past')}
            </p>
          </div>
        ) : null}
      </header>

      {event.invitationStatus === 'published' ? (
        <Alert tone="success" title={t('publishing.statusPublished')}>
          <a
            href={appUrl(`/p/${event.invitationSlug}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm underline underline-offset-4"
          >
            {appUrl(`/p/${event.invitationSlug}`)}
          </a>
        </Alert>
      ) : (
        <Alert tone="info" title={t('dashboard.notPublishedTitle')}>
          {t('dashboard.notPublishedText')}
        </Alert>
      )}

      <section aria-labelledby="statistika">
        <h2 id="statistika" className="sr-only">
          {t('dashboard.title')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5 pt-5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-display text-3xl font-semibold">
                  {stat.value}
                </dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="precice">
        <h2 id="precice" className="mb-3 text-sm font-medium text-muted-foreground">
          {t('dashboard.quickActions')}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.href}
              asChild
              variant="secondary"
              className="h-auto justify-between px-5 py-4"
            >
              <Link href={shortcut.href}>
                <span className="flex items-center gap-2.5">
                  <shortcut.icon className="size-4" aria-hidden />
                  {shortcut.label}
                </span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="aktivnosti">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.activityTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p id="aktivnosti" className="text-sm text-muted-foreground">
              {t('dashboard.activityEmpty')}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
