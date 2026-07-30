'use client';

import { MailCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { useLocale, useTranslations } from '@/i18n/client';
import { formatDateTime } from '@/i18n/format';
import { deleteResponseAction } from '@/server/actions/rsvp';

import { formatAnswer } from './export';

import type { RsvpAnswerValue, RsvpQuestion, RsvpStatus } from './types';

export type ResponseListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: RsvpStatus;
  adultsCount: number;
  childrenCount: number;
  companions: string[];
  message: string | null;
  /** ISO oblik - kroz granicu server/klijent ide tekst. */
  submittedAt: string;
  lastEditedAt: string | null;
  guestName: string | null;
  householdName: string | null;
  answers: Record<string, RsvpAnswerValue>;
};

/**
 * Pregled odgovora (zahtev 12).
 *
 * Kartice umesto tabele: odgovor nosi i slobodan tekst (poruka domaćinima,
 * odgovori na dodatna pitanja), a to u ćeliji tabele postane nečitljivo.
 */
export function ResponseList({
  eventId,
  responses,
  questions,
  canManage,
  timeZone,
}: {
  eventId: string;
  responses: readonly ResponseListItem[];
  questions: readonly RsvpQuestion[];
  canManage: boolean;
  timeZone: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  if (responses.length === 0) {
    return (
      <EmptyState
        icon={<MailCheck aria-hidden />}
        title={t('responses.emptyTitle')}
        description={t('responses.emptyText')}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {responses.map((response) => (
        <li
          key={response.id}
          className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {response.fullName}
                {response.guestName && response.guestName !== response.fullName ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({response.guestName}, {t('responses.viaLink')})
                  </span>
                ) : null}
              </p>

              <p className="text-xs text-muted-foreground">
                {formatDateTime(new Date(response.submittedAt), locale, { timeZone })}
                {response.lastEditedAt
                  ? ` · ${t('responses.editedAt', {
                      date: formatDateTime(new Date(response.lastEditedAt), locale, {
                        timeZone,
                      }),
                    })}`
                  : ''}
              </p>

              {response.email || response.phone ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[response.email, response.phone].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              {response.householdName ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {response.householdName}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={response.status} />

              {canManage ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Trash2 aria-hidden />
                      <span className="sr-only">{t('responses.deleteResponse')}</span>
                    </Button>
                  }
                  title={t('responses.deleteResponse')}
                  description={t('responses.deleteConfirm', { name: response.fullName })}
                  confirmLabel={t('common.delete')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={async () => {
                    const result = await deleteResponseAction({
                      eventId,
                      responseId: response.id,
                    });
                    if (!result.ok) return result.message;
                    toast.success(t('responses.deleted'));
                    router.refresh();
                    return null;
                  }}
                />
              ) : null}
            </div>
          </div>

          {response.status === 'yes' ? (
            <p className="mt-3 text-sm">
              {response.adultsCount} {t('responses.adults')}
              {response.childrenCount > 0
                ? ` · ${response.childrenCount} ${t('responses.children')}`
                : ''}
            </p>
          ) : null}

          {response.companions.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('responses.companions')}: {response.companions.join(', ')}
            </p>
          ) : null}

          {response.message ? (
            <p className="mt-3 whitespace-pre-wrap rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
              {response.message}
            </p>
          ) : null}

          {questions.length > 0 ? (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {questions.map((question) => {
                const value = response.answers[question.id];
                if (value === undefined) return null;

                return (
                  <div key={question.id} className="flex flex-wrap gap-2">
                    <dt className="text-muted-foreground">{question.label}:</dt>
                    <dd>{formatAnswer(question, value, t('common.yes'), t('common.no'))}</dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: RsvpStatus }) {
  const t = useTranslations();

  if (status === 'yes') return <Badge variant="success">{t('responses.filterYes')}</Badge>;
  if (status === 'no') return <Badge variant="neutral">{t('responses.filterNo')}</Badge>;
  if (status === 'maybe') return <Badge variant="warning">{t('responses.filterMaybe')}</Badge>;
  return <Badge variant="neutral">{t('responses.summaryPending')}</Badge>;
}
