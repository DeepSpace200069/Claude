'use client';

import { useSyncExternalStore } from 'react';

import {
  readConsentCookie,
  writeConsentCookie,
  type ConsentChoice,
  type ConsentState,
} from './consent';

/**
 * Odluka o pristanku kao spoljni izvor podataka.
 *
 * `document.cookie` se menja izvan Reacta (druga kartica, stranica o
 * kolačićima, sam korisnik), pa se čita kroz `useSyncExternalStore` - isto kao
 * favoriti. Time nema `setState` u efektu ni kaskadnih rendera, a sve
 * komponente na stranici vide istu odluku u istom trenutku.
 */
const EVENT_NAME = 'pozivnica:pristanak';

/**
 * Keširan snimak.
 *
 * `getSnapshot` mora da vrati **istu referencu** dok se odluka nije promenila;
 * nov objekat pri svakom pozivu bi React uveo u beskonačnu petlju rendera.
 */
let cachedRaw: string | null = null;
let cachedValue: ConsentState | null = null;

function getSnapshot(): ConsentState | null {
  const raw = typeof document === 'undefined' ? null : document.cookie;

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readConsentCookie();
  }

  return cachedValue;
}

/**
 * Na serveru odluke nema.
 *
 * Zbog toga se traka i podešavanja prvo iscrtaju kao „još ne znamo”, pa tek
 * posle hidracije prikažu stvarno stanje - to je cena keširane javne stranice,
 * koja se ne sme renderovati po kolačiću.
 */
function getServerSnapshot(): ConsentState | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useConsent(): ConsentState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Da li je komponenta već videla pravu vrednost iz pregledača. */
export function useConsentReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function decideConsent(choice: ConsentChoice): void {
  writeConsentCookie(choice);
  // Obaveštava sve pretplaćene komponente na ovoj stranici; `storage` događaj
  // pregledač šalje samo drugim karticama, ne i ovoj.
  window.dispatchEvent(new Event(EVENT_NAME));
}
