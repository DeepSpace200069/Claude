'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  History,
  Loader2,
  Redo2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { formatTime } from '@/i18n/format';
import { useLocale, useTranslations } from '@/i18n/client';
import { listRevisionsAction, loadRevisionAction } from '@/server/actions/invitations';
import type { RevisionSummary } from '@/server/services/invitations';
import { cn } from '@/lib/utils';

import { useEditorConfig } from './context';
import {
  useEditorActions,
  useEditorDispatch,
  useEditorState,
  useHistoryState,
  useIsDirty,
} from './store';
import type { AutosaveController } from './use-autosave';

/**
 * Gornja traka uređivača: stanje čuvanja, istorija i razrešavanje sudara.
 *
 * Stanje čuvanja je namerno uvek vidljivo. Autosave koji radi „negde u pozadini"
 * bez ijednog traga je najbrži način da korisnik izgubi poverenje u aplikaciju -
 * ili, gore, da izgubi rad misleći da je sačuvan (zahtev 26).
 */
export function EditorToolbar({
  eventName,
  autosave,
}: {
  eventName: string;
  autosave: AutosaveController;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const config = useEditorConfig();
  const state = useEditorState();
  const actions = useEditorActions();
  const { canUndo, canRedo } = useHistoryState();
  const isDirty = useIsDirty();

  const { save } = state;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/app/dogadjaji/${config.eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t('editor.backToEvent')}</span>
        </Link>
        <span className="truncate text-sm font-medium">{eventName}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <SaveIndicator
          status={save.status}
          savedAt={save.savedAt}
          message={save.message}
          isDirty={isDirty}
          locale={locale}
        />

        <button
          type="button"
          onClick={actions.undo}
          disabled={!canUndo}
          aria-label={t('editor.history.undo')}
          title={t('editor.history.undo')}
          className={toolbarButtonClass}
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={actions.redo}
          disabled={!canRedo}
          aria-label={t('editor.history.redo')}
          title={t('editor.history.redo')}
          className={toolbarButtonClass}
        >
          <Redo2 className="size-4" aria-hidden />
        </button>

        <RevisionsDialog />

        {save.status === 'error' ? (
          <Button type="button" size="sm" onClick={() => void autosave.saveNow()}>
            {t('editor.save.retry')}
          </Button>
        ) : null}
      </div>

      <ConflictDialog autosave={autosave} />
    </header>
  );
}

const toolbarButtonClass = cn(
  'inline-flex size-9 items-center justify-center rounded-[var(--radius-xs)]',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
  'disabled:opacity-35 disabled:hover:bg-transparent',
);

function SaveIndicator({
  status,
  savedAt,
  message,
  isDirty,
  locale,
}: {
  status: ReturnType<typeof useEditorState>['save']['status'];
  savedAt: number | null;
  message: string | null;
  isDirty: boolean;
  locale: ReturnType<typeof useLocale>;
}) {
  const t = useTranslations();

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
function ConflictDialog({ autosave }: { autosave: AutosaveController }) {
  const t = useTranslations();
  const state = useEditorState();
  const [busy, setBusy] = useState(false);

  const open = state.save.status === 'conflict';

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
                await autosave.saveNow({
                  baseRevision: state.save.serverRevision ?? state.revision,
                });
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

/** Spisak snimljenih verzija; vraćanje ubacuje verziju kao običnu izmenu. */
function RevisionsDialog() {
  const t = useTranslations();
  const locale = useLocale();
  const config = useEditorConfig();
  const actions = useEditorActions();
  const dispatch = useEditorDispatch();
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    const result = await listRevisionsAction(config.eventId);
    setRevisions(result.ok ? result.data : []);
    setBusy(false);
  };

  const restore = async (revisionId: string) => {
    setBusy(true);
    const result = await loadRevisionAction({
      eventId: config.eventId,
      revisionId,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    actions.replaceDocument(result.data.document);
    dispatch({ kind: 'select', sectionId: result.data.document.sections[0]?.id ?? null });
    setOpen(false);
    toast.success(t('editor.history.restored'));
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
                  <p className="text-xs text-muted-foreground">
                    {t('editor.history.sectionCount', { count: revision.sectionCount })}
                  </p>
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
