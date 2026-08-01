'use client';

import { ArrowLeft, Redo2, Undo2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { loadRevisionAction } from '@/server/actions/invitations';

import { useEditorConfig } from './context';
import {
  ConflictDialogView,
  RevisionsDialog,
  SaveIndicator,
  toolbarButtonClass,
} from './save-status';
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
  const config = useEditorConfig();
  const state = useEditorState();
  const actions = useEditorActions();
  const dispatch = useEditorDispatch();
  const { canUndo, canRedo } = useHistoryState();
  const isDirty = useIsDirty();

  const { save } = state;

  /**
   * Vraćanje starije verzije.
   *
   * Ne upisuje ništa - ubacuje dokument kao običnu izmenu, pa korisnik prvo vidi
   * šta dobija, „poništi" i dalje radi, a upis ide kroz isto čuvanje kao svaka
   * druga izmena.
   */
  const restoreRevision = async (revisionId: string): Promise<boolean> => {
    const result = await loadRevisionAction({ eventId: config.eventId, revisionId });

    if (!result.ok) {
      toast.error(result.message);
      return false;
    }

    actions.replaceDocument(result.data.document);
    dispatch({ kind: 'select', sectionId: result.data.document.sections[0]?.id ?? null });
    toast.success(t('editor.history.restored'));
    return true;
  };

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

        <RevisionsDialog
          eventId={config.eventId}
          onRestore={restoreRevision}
          describe={(revision) =>
            t('editor.history.sectionCount', { count: revision.sectionCount })
          }
        />

        {save.status === 'error' ? (
          <Button type="button" size="sm" onClick={() => void autosave.saveNow()}>
            {t('editor.save.retry')}
          </Button>
        ) : null}
      </div>

      <ConflictDialogView
        open={save.status === 'conflict'}
        onKeepMine={() =>
          autosave.saveNow({ baseRevision: save.serverRevision ?? state.revision })
        }
      />
    </header>
  );
}
