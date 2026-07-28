'use client';

import { useSyncExternalStore } from 'react';

/**
 * Omiljeni šabloni.
 *
 * `localStorage` je spoljni izvor podataka koji se menja izvan Reacta (druga
 * kartica, druga komponenta), pa se čita kroz `useSyncExternalStore`. Time
 * nema `setState` u efektu ni kaskadnih rendera, a sve komponente na stranici
 * vide istu vrednost u istom trenutku.
 *
 * Favoriti se čuvaju lokalno, a ne u bazi: posetilac bira šablone **pre** nego
 * što napravi nalog (zahtev 5, posetilac).
 */
const STORAGE_KEY = 'pozivnica_favoriti';
const EVENT_NAME = 'pozivnica:favoriti';

const EMPTY: string[] = [];

/**
 * Keširan snimak.
 *
 * `getSnapshot` mora da vrati **istu referencu** dok se podaci nisu promenili;
 * novi niz pri svakom pozivu bi React uveo u beskonačnu petlju rendera.
 */
let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const slugs = parsed.filter((value): value is string => typeof value === 'string');
    return slugs.length > 0 ? slugs : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Privatni režim: favoriti su ugodnost, ne uslov da galerija radi.
    return EMPTY;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }

  return cachedValue;
}

/** Na serveru favorita nema - lista je uvek prazna i uvek ista referenca. */
function getServerSnapshot(): string[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT_NAME, onChange);
  // `storage` hvata izmene iz druge kartice istog sajta.
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function toggleFavorite(slug: string): void {
  const current = getSnapshot();
  const next = current.includes(slug)
    ? current.filter((item) => item !== slug)
    : [...current, slug];

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }

  // Obaveštava sve pretplaćene komponente na ovoj stranici; `storage` događaj
  // pregledač šalje samo drugim karticama, ne i ovoj.
  window.dispatchEvent(new Event(EVENT_NAME));
}
