import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { appUrl } from '@/config/brand';
import { PublishControls } from '@/features/invitations/publish-controls';
import { PublishingForm } from '@/features/invitations/publishing-form';
import { qrDataUrl } from '@/features/invitations/qr';
import { SharePanel } from '@/features/invitations/share-panel';
import { formatDate } from '@/i18n/format';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { getEventDetail } from '@/server/services/events';
import { getInvitationStats } from '@/server/services/public-invitation';
import { getPublicationState } from '@/server/services/publishing';

/**
 * Objavljivanje, privatnost i deljenje (zahtev 4.2–4.6).
 *
 * Sve što se tiče javnog linka je na jednom mestu: status, ko sme da vidi,
 * do kada važi, kako izgleda kartica pri deljenju, sam link, QR kod i zbirna
 * statistika pregleda.
 */
export default async function PublishingPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'event:view');

  const [event, state] = await Promise.all([
    getEventDetail(eventId),
    getPublicationState(eventId, access.user.id),
  ]);

  if (!event || !state) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const url = appUrl(`/p/${state.slug}`);
  const stats = await getInvitationStats(state.invitationId, event.timeZone);

  // Datum isteka se u formi prikazuje kao dan u vremenskoj zoni događaja - isti
  // dan koji je korisnik i uneo, bez pomeranja zbog UTC-a.
  const expiresOn = state.expiresAt
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: event.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(state.expiresAt)
    : '';

  const isPublished = state.status === 'published';

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        publishing: messages.publishing,
        share: messages.share,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('publishing.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('publishing.subtitle')}
          </p>
        </header>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{t('publishing.statusLabel')}</CardTitle>
            <Badge variant={isPublished ? 'success' : 'warning'}>
              {isPublished
                ? t('publishing.statusPublished')
                : state.status === 'unpublished'
                  ? t('publishing.statusUnpublished')
                  : t('publishing.statusDraft')}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPublished && state.publishedAt ? (
              <p className="text-sm text-muted-foreground">
                {t('publishing.publishedAt', {
                  date: formatDate(state.publishedAt, locale, {
                    timeZone: event.timeZone,
                  }),
                })}
              </p>
            ) : null}

            <PublishControls
              eventId={eventId}
              status={state.status}
              canPublish={state.canPublish}
              planName={state.planName}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('share.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isPublished ? (
              <SharePanel
                eventId={eventId}
                url={url}
                qrImageUrl={qrDataUrl(url, { color: '#000000' })}
              />
            ) : (
              <Alert tone="info" title={t('share.notPublishedTitle')}>
                {t('share.notPublishedText')}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('publishing.privacyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PublishingForm
              eventId={eventId}
              hasPin={state.hasPin}
              initial={{
                privacy: state.privacy,
                expiresOn,
                shareTitle: state.shareTitle ?? '',
                shareDescription: state.shareDescription ?? '',
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('share.statsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('share.statsToday'), value: stats.today },
                { label: t('share.statsTotal'), value: stats.total },
                { label: t('share.statsUnique'), value: stats.unique },
                { label: t('share.statsShares'), value: stats.shares },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[var(--radius)] border border-border p-3"
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">{t('share.statsNote')}</p>
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
}
