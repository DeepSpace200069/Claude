'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';

import type { ThemeTokens } from '@/features/themes/tokens';
import type { MediaAsset } from '@/server/services/media';

import {
  addSection,
  documentsEqual,
  duplicateSection,
  moveSection,
  moveSectionBy,
  removeSection,
  resetSection,
  setSectionVisibility,
  setTheme,
  updateSectionData,
  type EditorDocument,
} from './document';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  replacePresent,
  undo,
  type History,
} from './history';

/**
 * Stanje uređivača (zahtev 26).
 *
 * Sve izmene prolaze kroz jedan reducer nad nepromenljivim dokumentom. Zbog toga
 * su „poništi", „ponovi", detekcija nesačuvanih izmena i autosave izvedeni iz
 * istog izvora istine, umesto da svaki deo interfejsa vodi svoju kopiju stanja.
 */

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

export type SaveState = {
  status: SaveStatus;
  message: string | null;
  savedAt: number | null;
  /** Revizija koju server ima kad dođe do sudara sa drugom sesijom. */
  serverRevision: number | null;
};

export type EditorState = {
  history: History<EditorDocument>;
  /** Poslednje stanje za koje pouzdano znamo da je na serveru. */
  savedDocument: EditorDocument;
  revision: number;
  selectedSectionId: string | null;
  media: MediaAsset[];
  save: SaveState;
};

export type EditorAction =
  | { kind: 'edit'; document: EditorDocument; label?: string }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'select'; sectionId: string | null }
  | { kind: 'saveStart' }
  | { kind: 'saveSuccess'; document: EditorDocument; revision: number; savedAt: number }
  | { kind: 'saveError'; message: string }
  | { kind: 'saveConflict'; message: string; serverRevision: number }
  | { kind: 'serverReload'; document: EditorDocument; revision: number }
  | { kind: 'mediaAdded'; asset: MediaAsset }
  | { kind: 'mediaRemoved'; assetId: string }
  | { kind: 'mediaAltChanged'; assetId: string; altText: string };

export function createInitialState(
  document: EditorDocument,
  revision: number,
  media: MediaAsset[],
): EditorState {
  return {
    history: createHistory(document),
    savedDocument: document,
    revision,
    selectedSectionId: document.sections[0]?.id ?? null,
    media,
    save: { status: 'idle', message: null, savedAt: null, serverRevision: null },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.kind) {
    case 'edit': {
      if (documentsEqual(state.history.present, action.document)) return state;
      return {
        ...state,
        history: commit(state.history, action.document, { label: action.label }),
        // Sudar sa drugom sesijom ostaje vidljiv dok se ne razreši; obična
        // greška čuvanja se briše novim pokušajem.
        save:
          state.save.status === 'conflict'
            ? state.save
            : { ...state.save, status: 'pending', message: null },
      };
    }

    case 'undo': {
      if (!canUndo(state.history)) return state;
      return { ...state, history: undo(state.history), save: pending(state.save) };
    }

    case 'redo': {
      if (!canRedo(state.history)) return state;
      return { ...state, history: redo(state.history), save: pending(state.save) };
    }

    case 'select':
      return { ...state, selectedSectionId: action.sectionId };

    case 'saveStart':
      return { ...state, save: { ...state.save, status: 'saving', message: null } };

    case 'saveSuccess':
      return {
        ...state,
        // Namerno pamtimo dokument koji je **poslat**, a ne trenutni: ako je
        // korisnik kucao dok je čuvanje trajalo, izmene ostaju nesačuvane i
        // sledeći autosave ih pokupi.
        savedDocument: action.document,
        revision: action.revision,
        save: {
          status: 'saved',
          message: null,
          savedAt: action.savedAt,
          serverRevision: null,
        },
      };

    case 'saveError':
      return {
        ...state,
        save: { ...state.save, status: 'error', message: action.message },
      };

    case 'saveConflict':
      return {
        ...state,
        save: {
          status: 'conflict',
          message: action.message,
          savedAt: state.save.savedAt,
          serverRevision: action.serverRevision,
        },
      };

    case 'serverReload':
      return {
        ...state,
        history: replacePresent(state.history, action.document),
        savedDocument: action.document,
        revision: action.revision,
        selectedSectionId:
          action.document.sections.some(
            (section) => section.id === state.selectedSectionId,
          )
            ? state.selectedSectionId
            : (action.document.sections[0]?.id ?? null),
        save: { status: 'idle', message: null, savedAt: null, serverRevision: null },
      };

    case 'mediaAdded':
      return { ...state, media: [action.asset, ...state.media] };

    case 'mediaRemoved':
      return {
        ...state,
        media: state.media.filter((asset) => asset.id !== action.assetId),
      };

    case 'mediaAltChanged':
      return {
        ...state,
        media: state.media.map((asset) =>
          asset.id === action.assetId ? { ...asset, altText: action.altText } : asset,
        ),
      };

    default:
      return state;
  }
}

function pending(save: SaveState): SaveState {
  return save.status === 'conflict' ? save : { ...save, status: 'pending', message: null };
}

// --- Kontekst ---------------------------------------------------------------

const StateContext = createContext<EditorState | null>(null);
const DispatchContext = createContext<Dispatch<EditorAction> | null>(null);

export function EditorStateProvider({
  document,
  revision,
  media,
  children,
}: {
  document: EditorDocument;
  revision: number;
  media: MediaAsset[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    editorReducer,
    { document, revision, media },
    (init) => createInitialState(init.document, init.revision, init.media),
  );

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const state = useContext(StateContext);
  if (!state) {
    throw new Error('useEditorState mora biti korišćen unutar <EditorStateProvider>.');
  }
  return state;
}

export function useEditorDispatch(): Dispatch<EditorAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) {
    throw new Error('useEditorDispatch mora biti korišćen unutar <EditorStateProvider>.');
  }
  return dispatch;
}

export function useEditorDocument(): EditorDocument {
  return useEditorState().history.present;
}

/** Ima li izmena koje server još nije video. */
export function useIsDirty(): boolean {
  const state = useEditorState();
  return !documentsEqual(state.history.present, state.savedDocument);
}

/**
 * Radnje nad dokumentom.
 *
 * Svaka je tanak omotač oko čiste funkcije iz `document.ts` - komponente ne
 * znaju ništa o obliku stanja, pa se interfejs i model mogu menjati nezavisno.
 */
export type EditorActions = {
  addSection: (type: string, atIndex?: number) => string | null;
  removeSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;
  moveSection: (sectionId: string, toIndex: number) => void;
  nudgeSection: (sectionId: string, delta: number) => void;
  setVisibility: (sectionId: string, isVisible: boolean) => void;
  updateData: (sectionId: string, data: unknown, fieldPath?: string) => void;
  resetSection: (sectionId: string) => void;
  setTheme: (theme: ThemeTokens) => void;
  replaceDocument: (document: EditorDocument) => void;
  select: (sectionId: string | null) => void;
  undo: () => void;
  redo: () => void;
};

export function useEditorActions(): EditorActions {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const document = state.history.present;

  const edit = useCallback(
    (next: EditorDocument, label?: string) => {
      dispatch({ kind: 'edit', document: next, label });
    },
    [dispatch],
  );

  return useMemo<EditorActions>(
    () => ({
      addSection: (type, atIndex) => {
        const result = addSection(document, type, atIndex);
        if (!result.ok) return null;
        edit(result.document);
        dispatch({ kind: 'select', sectionId: result.sectionId });
        return result.sectionId;
      },
      removeSection: (sectionId) => edit(removeSection(document, sectionId)),
      duplicateSection: (sectionId) => {
        const result = duplicateSection(document, sectionId);
        if (!result.sectionId) return;
        edit(result.document);
        dispatch({ kind: 'select', sectionId: result.sectionId });
      },
      moveSection: (sectionId, toIndex) => edit(moveSection(document, sectionId, toIndex)),
      nudgeSection: (sectionId, delta) => edit(moveSectionBy(document, sectionId, delta)),
      setVisibility: (sectionId, isVisible) =>
        edit(setSectionVisibility(document, sectionId, isVisible)),
      updateData: (sectionId, data, fieldPath) =>
        // Oznaka spaja uzastopne izmene istog polja u jedan korak istorije, pa
        // „poništi" vraća celu reč, a ne poslednje otkucano slovo.
        edit(
          updateSectionData(document, sectionId, data),
          fieldPath ? `${sectionId}:${fieldPath}` : undefined,
        ),
      resetSection: (sectionId) => edit(resetSection(document, sectionId)),
      setTheme: (theme) => edit(setTheme(document, theme), 'theme'),
      replaceDocument: (next) => edit(next),
      select: (sectionId) => dispatch({ kind: 'select', sectionId }),
      undo: () => dispatch({ kind: 'undo' }),
      redo: () => dispatch({ kind: 'redo' }),
    }),
    [document, dispatch, edit],
  );
}

export function useHistoryState(): { canUndo: boolean; canRedo: boolean } {
  const { history } = useEditorState();
  return { canUndo: canUndo(history), canRedo: canRedo(history) };
}
