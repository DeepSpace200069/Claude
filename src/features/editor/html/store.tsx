'use client';

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';

import type {
  FieldDefinitions,
  FieldValues,
} from '@/features/templates/html-schema';
import type { MediaAsset } from '@/server/services/media';

/**
 * Stanje uređivača polja (zahtev 39.4).
 *
 * Namerno mnogo manje od stanja uređivača sekcija. Tamo se menja **struktura** -
 * sekcije se dodaju, brišu i premeštaju - pa je istorija poteza (`undo`/`redo`)
 * jedina odbrana od slučajnog gubitka rada. Ovde je sadržaj ravan skup polja u
 * formi; poništavanje kucanja pregledač već ume, po polju, bolje nego što bismo
 * mi umeli za celu formu odjednom. Ono što ovde zaista treba je **istorija
 * verzija**, i nju uređivač polja ima.
 */

export type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict';

export type FieldEditorState = {
  definitions: FieldDefinitions;
  /** Trenutne vrednosti u formi. */
  values: FieldValues;
  /** Poslednje stanje potvrđeno sa servera - po njemu se zna ima li nesačuvanog. */
  saved: FieldValues;
  revision: number;
  media: MediaAsset[];
  save: { status: SaveStatus; savedAt: number | null; message: string | null };
  /** Greške po ključu polja; dolaze sa servera, prikazuju se uz samo polje. */
  errors: Record<string, string[]>;
};

export type FieldEditorAction =
  | { kind: 'setValue'; key: string; value: string }
  | { kind: 'addMedia'; assets: MediaAsset[] }
  | { kind: 'saveStart' }
  | { kind: 'saveSuccess'; values: FieldValues; revision: number; savedAt: number }
  | { kind: 'saveError'; message: string; errors?: Record<string, string[]> }
  | { kind: 'saveConflict'; message: string; serverRevision: number }
  /** Vraćena starija verzija ili promenjen šablon - sve kreće ispočetka. */
  | { kind: 'replace'; values: FieldValues; definitions?: FieldDefinitions };

export function fieldEditorReducer(
  state: FieldEditorState,
  action: FieldEditorAction,
): FieldEditorState {
  switch (action.kind) {
    case 'setValue': {
      if (state.values[action.key] === action.value) return state;

      // Greška polja nestaje čim korisnik krene da je ispravlja; poruka koja
      // stoji dok se kuca deluje kao da ispravka ne pomaže.
      const { [action.key]: _removed, ...errors } = state.errors;

      return {
        ...state,
        values: { ...state.values, [action.key]: action.value },
        errors,
      };
    }

    case 'addMedia':
      return { ...state, media: [...action.assets, ...state.media] };

    case 'saveStart':
      return { ...state, save: { ...state.save, status: 'saving', message: null } };

    case 'saveSuccess':
      return {
        ...state,
        saved: action.values,
        revision: action.revision,
        errors: {},
        save: { status: 'idle', savedAt: action.savedAt, message: null },
      };

    case 'saveError':
      return {
        ...state,
        errors: action.errors ?? state.errors,
        save: { ...state.save, status: 'error', message: action.message },
      };

    case 'saveConflict':
      return {
        ...state,
        revision: action.serverRevision,
        save: { ...state.save, status: 'conflict', message: action.message },
      };

    case 'replace':
      return {
        ...state,
        definitions: action.definitions ?? state.definitions,
        values: action.values,
        errors: {},
      };
  }
}

/** Ima li izmena koje još nisu na serveru. */
export function isDirty(state: FieldEditorState): boolean {
  const keys = new Set([...Object.keys(state.values), ...Object.keys(state.saved)]);
  for (const key of keys) {
    if ((state.values[key] ?? '') !== (state.saved[key] ?? '')) return true;
  }
  return false;
}

const StateContext = createContext<FieldEditorState | null>(null);
const DispatchContext = createContext<Dispatch<FieldEditorAction> | null>(null);

export function FieldEditorProvider({
  definitions,
  values,
  revision,
  media,
  children,
}: {
  definitions: FieldDefinitions;
  values: FieldValues;
  revision: number;
  media: MediaAsset[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(fieldEditorReducer, null, () => ({
    definitions,
    values,
    saved: values,
    revision,
    media,
    save: { status: 'idle' as const, savedAt: null, message: null },
    errors: {},
  }));

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useFieldEditorState(): FieldEditorState {
  const state = useContext(StateContext);
  if (!state) {
    throw new Error('useFieldEditorState mora biti unutar <FieldEditorProvider>.');
  }
  return state;
}

export function useFieldEditorDispatch(): Dispatch<FieldEditorAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) {
    throw new Error('useFieldEditorDispatch mora biti unutar <FieldEditorProvider>.');
  }
  return dispatch;
}

export function useIsFieldEditorDirty(): boolean {
  const state = useFieldEditorState();
  return useMemo(() => isDirty(state), [state]);
}
