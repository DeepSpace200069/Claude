'use client';

import { AlertTriangle, Check, History, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale, useTranslations } from '@/i18n/client';
import { formatTime } from '@/i18n/format';
import { listRevisionsAction } from '@/server/actions/invitations';
import type { RevisionSummary } from '@/server/services/invitations';
import { cn } from '@/lib/utils';

/**
 * Deljeni delovi gornje trake uređivača.
 *
 * Uređivač sekcija i uređivač polja imaju različito stanje - jedan vodi istoriju
 * poteza nad strukturom, drugi ravan skup vrednosti - ali **isto ponašanje**
 * prema korisniku: isti prikaz čuvanja, isti izlaz iz sudara sa drugom sesijom,
 * ista istorija verzija. Zato je ovde ono što se vidi, a svaka strana donosi
 * svoje ponašanje kroz props.
 *
 * Bez ovog izdvajanja bi se dva uređivača vremenom raziša u sitnicama koje
 * korisnik i primeti - koliko dugo stoji „sačuvano", šta piše pri grešci - a to
 * su upravo sitnice koje grade poverenje da rad nije izgubljen (zahtev 26).
 */

export const toolbarButtonClass = cn(
  'inline-flex size-9 items-center justify-center rounded-[var(--radius-xs)]',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:opacity-35 disabled:hover:bg-transparent',
);

export type IndicatorStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict';

/**
 * Stanje čuvanja, uvek vidljivo.
 *
 * Autosave koji radi „negde u pozadini" bez ijednog traga je najbrži način da
 * korisnik izgubi poverenje u aplikaciju - ili, gore, da izgubi rad misleći da
 * je sačuvan.
 */
export function SaveIndicator({
  status,
  savedAt,
  message,
  isDirty,
}: {
  status: IndicatorStatus;
  savedAt: number | null;
  message: string | null;
  isDirty: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const label =
    status === 'saving'
      ? t('editor.save.saving')
      : status === 'error'
        ? (message ?? t('editor.save.error'))
        : status === 'conflict'
          ? t('editor.conflict.title')
          : isDirty
            ? t('editor.save.pending')
            : savedAt
              ? t('editor.save.savedAt', {
                  time: formatTime(new Date(savedAt), locale, {
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  }),
                })
              : t('editor.save.saved');

  const tone =
    status === 'error' || status === 'conflict'
      ? 'text-destructive'
      : isDirty || status === 'saving'
        ? 'text-muted-foreground'
        : 'text-success';

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('mr-1 flex items-center gap-1.5 text-xs', tone)}
    >
      {status === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : status === 'error' || status === 'conflict' ? (
        <AlertTriangle className="size-3.5" aria-hidden />
      ) : isDirty ? null : (
        <Check className="size-3.5" aria-hidden />
      )}
      <span className="max-w-[16rem] truncate">{label}</span>
    </p>
  );
}

/**
 * Razrešavanje sudara sa drugom sesijom.
 *
 * Nudimo dva izlaza i oba jasno imenujemo. Automatsko spajanje ovde ne postoji
 * namerno: dva različita teksta u istom polju nemaju tačno rešenje koje bismo
 * mogli da pogodimo umesto korisnika (zahtev 26).
 */
export function ConflictDialogView({
  open,
  onKeepMine,
}: {
  open: boolean;
  onKeepMine: () => Promise<void>;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('editor.conflict.title')}</DialogTitle>
          <DialogDescription>{t('editor.conflict.text')}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="w-full">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                // Ponovno učitavanje stranice je jedini način da se sigurno
                // dobije serverska verzija zajedno sa svim izvedenim podacima.
                window.location.reload();
              }}
            >
              {t('editor.conflict.reload')}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('editor.conflict.reloadHint')}
            </p>
          </div>

          <div className="w-full">
            <Button
              type="button"
              className="w-full"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onKeepMine();
                setBusy(false);
              }}
            >
              {t('editor.conflict.keepMine')}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('editor.conflict.keepMineHint')}
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Spisak snimljenih verzija; vraćanje ubacuje verziju kao običnu izmenu.
 *
 * `describe` daje drugi red stavke, jer se sadržaj razlikuje po vrsti
 * pozivnice - broj sekcija nema smisla tamo gde sekcija nema.
 */
export function RevisionsDialog({
  eventId,
  onRestore,
  describe,
}: {
  eventId: string;
  onRestore: (revisionId: string) => Promise<boolean>;
  describe?: (revision: RevisionSummary) => ReactNode;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    const result = await listRevisionsAction(eventId);
    setRevisions(result.ok ? result.data : []);
    setBusy(false);
  };

  const restore = async (revisionId: string) => {
    setBusy(true);
    const done = await onRestore(revisionId);
    setBusy(false);
    if (done) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        aria-label={t('editor.history.revisions')}
        title={t('editor.history.revisions')}
        className={toolbarButtonClass}
      >
        <History className="size-4" aria-hidden />
      </button>

      <DialogContent className="max-w-md" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('editor.history.revisionsTitle')}</DialogTitle>
          <DialogDescription>
            {t('editor.history.revisionsDescription')}
          </DialogDescription>
        </DialogHeader>

        {revisions === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('editor.history.revisionsEmpty')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {formatTime(new Date(revision.createdAt), locale, {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })}
                  </p>
                  {describe ? (
                    <p className="text-xs text-muted-foreground">{describe(revision)}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void restore(revision.id)}
                >
                  {t('editor.history.restore')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
