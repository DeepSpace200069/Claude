import { Download } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { QuestionManager } from '@/features/rsvp/question-manager';
import { ReminderPanel } from '@/features/rsvp/reminder-panel';
import { ResponseList } from '@/features/rsvp/response-list';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { roleHasPermission } from '@/server/authz/permissions';
import { getEventDetail, getEventStats } from '@/server/services/events';
import { listGuestsWithoutResponse } from '@/server/services/guests';
import {
  listRsvpQuestionsForEvent,
  listRsvpResponses,
} from '@/server/services/rsvp';

const filtersSchema = z.object({
  odgovor: z.enum(['svi', 'yes', 'no', 'maybe']).default('svi'),
  pretraga: z.string().trim().max(80).optional(),
  redosled: z.enum(['najnoviji', 'ime']).default('najnoviji'),
});

/**
 * Odgovori gostiju (zahtev 12 i 5.10).
 *
 * Tri stvari na jednom mestu, jer se koriste zajedno: šta su gosti odgovorili,
 * šta ih još pitamo i ko još nije odgovorio.
 */
export default async function ResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const access = await requireEventPageAccess(eventId, 'rsvp:view');

  const query = await searchParams;
  const filters = filtersSchema.parse({
    odgovor: single(query.odgovor) ?? 'svi',
    pretraga: single(query.pretraga),
    redosled: single(query.redosled) ?? 'najnoviji',
  });

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const [responses, questions, stats, pending] = await Promise.all([
    listRsvpResponses(eventId, filters),
    listRsvpQuestionsForEvent(eventId),
    getEventStats(eventId),
    listGuestsWithoutResponse(eventId),
  ]);

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const canManage = roleHasPermission(access.role, 'rsvp:manage');

  const summary = [
    { label: t('responses.summaryConfirmed'), value: stats.confirmed },
    { label: t('responses.summaryDeclined'), value: stats.declined },
    { label: t('responses.summaryPending'), value: stats.pending },
    { label: t('responses.summaryPeople'), value: stats.adults + stats.children },
  ];

  const selectClass =
    'h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm';

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        responses: messages.responses,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t('responses.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('responses.subtitle')}
            </p>
          </div>

          <Button asChild variant="secondary">
            <Link href={`/app/dogadjaji/${eventId}/odgovori/izvoz`} prefetch={false}>
              <Download aria-hidden />
              {t('responses.exportAction')}
            </Link>
          </Button>
        </header>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5 pt-5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="mt-1 font-display text-3xl font-semibold">
                  {item.value}
                </dd>
              </CardContent>
            </Card>
          ))}
        </dl>

        <form
          method="get"
          className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:grid-cols-3"
        >
          <div>
            <label htmlFor="pretraga" className="mb-1.5 block text-sm font-medium">
              {t('responses.search')}
            </label>
            <Input
              id="pretraga"
              name="pretraga"
              type="search"
              defaultValue={filters.pretraga ?? ''}
              placeholder={t('responses.searchPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="odgovor" className="mb-1.5 block text-sm font-medium">
              {t('responses.columnStatus')}
            </label>
            <select
              id="odgovor"
              name="odgovor"
              defaultValue={filters.odgovor}
              className={selectClass}
            >
              <option value="svi">{t('responses.filterAll')}</option>
              <option value="yes">{t('responses.filterYes')}</option>
              <option value="no">{t('responses.filterNo')}</option>
              <option value="maybe">{t('responses.filterMaybe')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="redosled" className="mb-1.5 block text-sm font-medium">
              {t('responses.columnDate')}
            </label>
            <select
              id="redosled"
              name="redosled"
              defaultValue={filters.redosled}
              className={selectClass}
            >
              <option value="najnoviji">{t('responses.sortNewest')}</option>
              <option value="ime">{t('responses.sortName')}</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary">
              {t('common.filter')}
            </Button>
          </div>
        </form>

        <ResponseList
          eventId={eventId}
          canManage={canManage}
          timeZone={event.timeZone}
          questions={questions}
          responses={responses.map((response) => ({
            id: response.id,
            fullName: response.fullName,
            email: response.email,
            phone: response.phone,
            status: response.status,
            adultsCount: response.adultsCount,
            childrenCount: response.childrenCount,
            companions: response.companions,
            message: response.message,
            submittedAt: response.submittedAt.toISOString(),
            lastEditedAt: response.lastEditedAt?.toISOString() ?? null,
            guestName: response.guestName,
            householdName: response.householdName,
            answers: response.answers,
          }))}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('responses.questionsTitle')}
              </CardTitle>
              <CardDescription>{t('responses.questionsSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <QuestionManager eventId={eventId} questions={questions} />
              ) : (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {questions.map((question) => (
                    <li key={question.id}>{question.label}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('responses.remindersTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReminderPanel
                guests={pending
                  .filter((guest) => guest.hasLink)
                  .map((guest) => ({
                    id: guest.id,
                    name: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
                    email: guest.email,
                    phone: guest.phone,
                  }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </TranslationsProvider>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim() !== '' ? first : undefined;
}
