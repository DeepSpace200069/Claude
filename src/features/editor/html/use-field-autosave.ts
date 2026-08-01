'use client';

import { useCallback, useEffect } from 'react';

import { validateFieldValues } from '@/features/templates/html-schema';
import { saveInvitationFieldsAction } from '@/server/actions/invitations';

import { AUTOSAVE_DELAY_MS } from '../use-autosave';
import {
  useFieldEditorDispatch,
  useFieldEditorState,
  useIsFieldEditorDirty,
} from './store';

/**
 * Automatsko čuvanje polja (zahtev 26 i 39.4).
 *
 * Ista pravila kao kod sekcija - čuva se tek kad kucanje stane, nikad dva
 * čuvanja odjednom, sudar zaustavlja autosave i pita korisnika - i namerno isto
 * kašnjenje, da bi se uređivač u oba slučaja ponašao isto.
 *
 * Razlika je u proveri pre slanja: vrednosti se mere **definicijama polja iz
 * same pozivnice**, istom funkcijom koju server koristi. Zahvaljujući tome
 * poruka o grešci je ista bez obzira gde je nastala, i stoji uz polje, a ne kao
 * opšte upozorenje.
 */
export type FieldAutosaveController = {
  saveNow: (options?: { baseRevision?: number }) => Promise<void>;
};

export function useFieldAutosave(eventId: string): FieldAutosaveController {
  const state = useFieldEditorState();
  const dispatch = useFieldEditorDispatch();
  const dirty = useIsFieldEditorDirty();

  const { values, definitions, revision } = state;
  const status = state.save.status;

  const persist = useCallback(
    async (baseRevision: number) => {
      const checked = validateFieldValues(definitions, values);
      if (Object.keys(checked.errors).length > 0) {
        dispatch({
          kind: 'saveError',
          message: 'Neka polja nisu ispravno popunjena.',
          errors: checked.errors,
        });
        return;
      }

      dispatch({ kind: 'saveStart' });

      const result = await saveInvitationFieldsAction({
        eventId,
        baseRevision,
        values: checked.values,
      });

      if (result.ok) {
        dispatch({
          kind: 'saveSuccess',
          values,
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

      dispatch({
        kind: 'saveError',
        message: result.message,
        ...(result.fieldErrors ? { errors: result.fieldErrors } : {}),
      });
    },
    [definitions, dispatch, eventId, values],
  );

  useEffect(() => {
    if (!dirty) return;
    if (status === 'saving' || status === 'conflict') return;

    const timer = setTimeout(() => {
      void persist(revision);
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [dirty, persist, revision, status]);

  const saveNow = useCallback(
    async (options: { baseRevision?: number } = {}) => {
      await persist(options.baseRevision ?? revision);
    },
    [persist, revision],
  );

  return { saveNow };
}
