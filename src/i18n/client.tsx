'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale } from './config';
import type { Messages } from './messages';
import {
  createTranslator,
  type MessageTree,
  type Translator,
} from './translator';

type TranslationContextValue = {
  locale: Locale;
  messages: MessageTree;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

/**
 * Prosleđuje prevode klijentskim komponentama.
 *
 * Namerno prima proizvoljno podstablo poruka umesto celog kataloga: stranica
 * prosledi samo prostor imena koji joj treba (npr. `wizard` i `common`), pa
 * javna pozivnica ne nosi prevode celog kontrolnog panela.
 */
export function TranslationsProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: MessageTree;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * Prevodilac u klijentskoj komponenti.
 *
 * Podrazumevani tip ključeva je ceo katalog aplikacije, pa TypeScript hvata
 * pogrešno otkucan ključ i u komponenti koja je dobila samo jedno podstablo
 * poruka. `Messages` se uvozi kao tip, tako da katalog ne ulazi u bundle.
 */
export function useTranslations<
  T extends MessageTree = Messages,
>(): Translator<T> {
  const context = useContext(TranslationContext);

  if (!context) {
    throw new Error(
      'useTranslations mora biti korišćen unutar <TranslationsProvider>.',
    );
  }

  return useMemo(
    () => createTranslator<T>(context.locale, context.messages as T),
    [context],
  );
}

/** Trenutni jezik u klijentskoj komponenti. */
export function useLocale(): Locale {
  return useContext(TranslationContext)?.locale ?? DEFAULT_LOCALE;
}
