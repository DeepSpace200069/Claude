'use client';

import { Check, EyeOff, MessageSquareHeart, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { useLocale, useTranslations } from '@/i18n/client';
import { formatDateTime } from '@/i18n/format';
import { deleteEntryAction, moderateEntryAction } from '@/server/actions/guestbook';

export type ModerationItem = {
  id: string;
  authorName: string;
  message: string;
  reaction: string | null;
  status: 'pending' | 'approved' | 'hidden';
  /** ISO oblik - kroz granicu server/klijent ide tekst. */
  createdAt: string;
};

/**
 * Moderacija knjige želja (zahtev 9).
 *
 * Poruka se ispisuje kao tekst (`whitespace-pre-wrap`), nikad kao HTML: ono što
 * gost napiše ne sme da se izvrši ni ovde, u panelu organizatora.
 */
export function ModerationList({
  eventId,
  entries,
  canModerate,
  timeZone,
}: {
  eventId: string;
  entries: readonly ModerationItem[];
  canModerate: boolean;
  timeZone: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareHeart aria-hidden />}
        title={t('guestbookAdmin.emptyTitle')}
        description={t('guestbookAdmin.emptyText')}
      />
    );
  }

  const moderate = async (
    entryId: string,
    status: 'approved' | 'hidden',
  ): Promise<void> => {
    const result = await moderateEntryAction({ eventId, entryId, status });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(
      status === 'approved' ? t('guestbookAdmin.approved') : t('guestbookAdmin.hidden'),
    );
    router.refresh();
  };

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {entry.reaction ? (
                  <span aria-hidden className="mr-1.5">
                    {entry.reaction}
                  </span>
                ) : null}
                {entry.authorName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(new Date(entry.createdAt), locale, { timeZone })}
              </p>
            </div>

            <StatusBadge status={entry.status} />
          </div>

          <p className="mt-3 whitespace-pre-wrap break-words rounded-[var(--radius)] bg-muted px-3 py-2 text-sm">
            {entry.message}
          </p>

          {canModerate ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.status !== 'approved' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void moderate(entry.id, 'approved')}
                >
                  <Check aria-hidden />
                  {t('guestbookAdmin.approve')}
                </Button>
              ) : null}

              {entry.status !== 'hidden' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void moderate(entry.id, 'hidden')}
                >
                  <EyeOff aria-hidden />
                  {t('guestbookAdmin.hide')}
                </Button>
              ) : null}

              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost">
                    <Trash2 aria-hidden />
                    {t('guestbookAdmin.deleteEntry')}
                  </Button>
                }
                title={t('guestbookAdmin.deleteEntry')}
                description={t('guestbookAdmin.deleteConfirm', {
                  name: entry.authorName,
                })}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={async () => {
                  const result = await deleteEntryAction({ eventId, entryId: entry.id });
                  if (!result.ok) return result.message;
                  toast.success(t('guestbookAdmin.deleted'));
                  router.refresh();
                  return null;
                }}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'hidden' }) {
  const t = useTranslations();

  if (status === 'approved') {
    return <Badge variant="success">{t('guestbookAdmin.statusApproved')}</Badge>;
  }
  if (status === 'hidden') {
    return <Badge variant="neutral">{t('guestbookAdmin.statusHidden')}</Badge>;
  }
  return <Badge variant="warning">{t('guestbookAdmin.statusPending')}</Badge>;
}
