import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { ModerationList } from '@/features/guestbook/moderation-list';
import { readGuestbookSection } from '@/features/rsvp/section-data';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { roleHasPermission } from '@/server/authz/permissions';
import { getEventDetail } from '@/server/services/events';
import { listGuestbookEntries } from '@/server/services/guestbook';
import { getInvitationForEditor } from '@/server/services/invitations';

const filterSchema = z.enum(['sve', 'pending', 'approved', 'hidden']).catch('sve');

/**
 * Moderacija knjige želja (zahtev 9).
 *
 * Ako sekcija nije na pozivnici, stranica to kaže i vodi u uređivač umesto da
 * prikaže prazan spisak - prazan spisak bi izgledao kao da poruke ne stižu,
 * a razlog je što ih niko ne može ni poslati.
 */
export default async function GuestbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'rsvp:view');

  const query = await searchParams;
  const raw = Array.isArray(query.status) ? query.status[0] : query.status;
  const filter = filterSchema.parse(raw ?? 'sve');

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const [entries, invitation] = await Promise.all([
    listGuestbookEntries(eventId, filter),
    getInvitationForEditor(eventId),
  ]);

  const hasSection =
    invitation !== null && readGuestbookSection(invitation.document) !== null;

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const canModerate = roleHasPermission(access.role, 'rsvp:manage');

  const filters = [
    { value: 'sve', label: t('guestbookAdmin.filterAll') },
    { value: 'pending', label: t('guestbookAdmin.filterPending') },
    { value: 'approved', label: t('guestbookAdmin.filterApproved') },
    { value: 'hidden', label: t('guestbookAdmin.filterHidden') },
  ];

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        guestbookAdmin: messages.guestbookAdmin,
        common: messages.common,
        errors: messages.errors,
      }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('guestbookAdmin.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('guestbookAdmin.subtitle')}
          </p>
        </header>

        {!hasSection ? (
          <Alert tone="info" title={t('guestbookAdmin.noSectionTitle')}>
            <p>{t('guestbookAdmin.noSectionText')}</p>
            <p className="mt-2">
              <Link
                href={`/app/dogadjaji/${eventId}/editor`}
                className="font-medium underline underline-offset-4"
              >
                {t('dashboard.openEditor')}
              </Link>
            </p>
          </Alert>
        ) : null}

        <nav aria-label={t('common.filter')} className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <Button
              key={option.value}
              asChild
              size="sm"
              variant={filter === option.value ? 'primary' : 'secondary'}
            >
              <Link
                href={`/app/dogadjaji/${eventId}/knjiga-zelja?status=${option.value}`}
              >
                {option.label}
              </Link>
            </Button>
          ))}
        </nav>

        <ModerationList
          eventId={eventId}
          canModerate={canModerate}
          timeZone={event.timeZone}
          entries={entries.map((entry) => ({
            id: entry.id,
            authorName: entry.authorName,
            message: entry.message,
            reaction: entry.reaction,
            status: entry.status,
            createdAt: entry.createdAt.toISOString(),
          }))}
        />
      </div>
    </TranslationsProvider>
  );
}
