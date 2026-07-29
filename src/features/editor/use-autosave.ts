'use client';

import { useCallback, useEffect } from 'react';

import { saveInvitationAction } from '@/server/actions/invitations';

import { validateDocument, type EditorDocument } from './document';
import { useEditorDispatch, useEditorState, useIsDirty } from './store';

/**
 * Automatsko čuvanje sa odloženim okidanjem (zahtev 26).
 *
 * Pravila su namerno jednostavna, jer se od njih zavisi svaka izmena:
 *
 * 1. Čuva se tek kad kucanje stane (`AUTOSAVE_DELAY_MS`) - inače bi svaki taster
 *    slao zahtev.
 * 2. Nikad dva čuvanja u isto vreme; sledeće se zakazuje tek kad prethodno
 *    završi, pa se izmene ne mogu preteći i upisati u pogrešnom redosledu.
 * 3. Sudar sa drugom sesijom zaustavlja autosave. Dalje odlučuje korisnik -
 *    tiho prepisivanje tuđih izmena nije opcija.
 */
export const AUTOSAVE_DELAY_MS = 1200;

export type AutosaveController = {
  /** Ručno čuvanje; `baseRevision` se zadaje samo pri razrešavanju sudara. */
  saveNow: (options?: { baseRevision?: number }) => Promise<void>;
};

export function useAutosave(eventId: string): AutosaveController {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const isDirty = useIsDirty();

  const document = state.history.present;
  const revision = state.revision;
  const status = state.save.status;

  const persist = useCallback(
    async (snapshot: EditorDocument, baseRevision: number) => {
      // Nevalidna sekcija se ne šalje: server bi je odbio, a korisnik bi dobio
      // grešku bez podatka koja sekcija je u pitanju. Poruka ide iz istog
      // koda koji server koristi, pa se opisi ne mogu raziću.
      const issues = validateDocument(snapshot);
      if (issues.length > 0) {
        const first = issues[0];
        dispatch({
          kind: 'saveError',
          message: first ? first.message : 'Neke sekcije nisu ispravno popunjene.',
        });
        return;
      }

      dispatch({ kind: 'saveStart' });

      const result = await saveInvitationAction({
        eventId,
        baseRevision,
        theme: snapshot.theme,
        sections: snapshot.sections,
      });

      if (result.ok) {
        dispatch({
          kind: 'saveSuccess',
          document: snapshot,
          revision: result.data.revision,
          savedAt: Date.parse(result.data.savedAt),
        });
        return;
      }

      if (result.code === 'conflict') {
        const serverRevision = Number(
          (result.details as { currentRevision?: number } | undefined)?.currentRevision,
        );
        dispatch({
          kind: 'saveConflict',
          message: result.message,
          serverRevision: Number.isFinite(serverRevision) ? serverRevision : baseRevision,
        });
        return;
      }

      dispatch({ kind: 'saveError', message: result.message });
    },
    [dispatch, eventId],
  );

  useEffect(() => {
    if (!isDirty) return;
    if (status === 'saving' || status === 'conflict') return;

    const timer = setTimeout(() => {
      void persist(document, revision);
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [document, revision, isDirty, status, persist]);

  const saveNow = useCallback(
    async (options: { baseRevision?: number } = {}) => {
      await persist(document, options.baseRevision ?? revision);
    },
    [document, persist, revision],
  );

  return { saveNow };
}

/**
 * Upozorenje pri napuštanju stranice sa nesačuvanim izmenama (zahtev 3.8).
 *
 * Autosave obično stigne pre nego što korisnik ode, pa se ovo javi tek kada
 * čuvanje nije uspelo ili je u toku - a tada je upozorenje zaista potrebno.
 */
export function useUnsavedChangesWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Pregledači prikazuju sopstvenu poruku; postavljanje `returnValue` je
      // jedini način da se dijalog uopšte pojavi.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
