/**
 * Istorija izmena za „poništi" i „ponovi" (zahtev 26).
 *
 * Dokument je nepromenljiva vrednost, pa je istorija običan niz vrednosti - bez
 * inverznih operacija koje treba održavati uz svaku novu radnju.
 *
 * Kucanje u polju pravi izmenu na svaki pritisak tastera. Bez objedinjavanja bi
 * jedno „poništi" vraćalo po jedno slovo, što nije ono što korisnik očekuje:
 * uzastopne izmene **istog polja** u kratkom roku ulaze u isti korak istorije.
 */
export type History<T> = {
  past: readonly T[];
  present: T;
  future: readonly T[];
  /** Oznaka poslednje izmene (npr. `section:<id>:title`). */
  lastLabel: string | null;
  lastAt: number;
};

/** Gornja granica koraka - istorija ne sme neograničeno da raste u memoriji. */
export const MAX_HISTORY = 50;

/** Prozor u kome se izmene istog polja spajaju u jedan korak. */
export const COALESCE_MS = 700;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastLabel: null, lastAt: 0 };
}

export type CommitOptions = {
  /**
   * Izmene sa istom oznakom u kratkom roku se spajaju. Bez oznake se svaka
   * izmena pamti zasebno (dodavanje, brisanje, promena redosleda...).
   */
  label?: string;
  now?: number;
  coalesceMs?: number;
};

export function commit<T>(
  history: History<T>,
  next: T,
  options: CommitOptions = {},
): History<T> {
  const now = options.now ?? Date.now();
  const coalesceMs = options.coalesceMs ?? COALESCE_MS;
  const label = options.label ?? null;

  const shouldCoalesce =
    label !== null && label === history.lastLabel && now - history.lastAt < coalesceMs;

  if (shouldCoalesce) {
    // Zamenjujemo trenutno stanje umesto da guramo novi korak: „poništi" i
    // dalje vraća na stanje pre nego što je korisnik počeo da kuca u to polje.
    return { ...history, present: next, future: [], lastAt: now };
  }

  const past = [...history.past, history.present];

  return {
    past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past,
    present: next,
    // Nova izmena posle „poništi" odbacuje granu koja se više ne može ponoviti.
    future: [],
    lastLabel: label,
    lastAt: now,
  };
}

/** Izmena koja se ne pamti (npr. usklađivanje sa serverom posle čuvanja). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next, lastLabel: null, lastAt: 0 };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastLabel: null,
    lastAt: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    lastLabel: null,
    lastAt: 0,
  };
}
