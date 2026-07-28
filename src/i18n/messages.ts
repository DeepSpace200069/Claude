import srLatn from './messages/sr-Latn';
import type { Locale } from './config';
import type { MessageKey, MessageTree, PluralForms } from './translator';

/**
 * Proširuje literalne tipove izvornog kataloga u obične `string` vrednosti i
 * prepoznaje objekte množine, tako da ostali jezici mogu da imaju drugačiji
 * tekst i drugačiji broj oblika množine (srpski ima `few`, engleski nema).
 *
 * Objekat se smatra množinom samo ako *svi* njegovi ključevi pripadaju CLDR
 * kategorijama. Provera „ima ključ `other`” ne bi bila dovoljna: prostor imena
 * `eventTypes` ima vrstu proslave `other` i pogrešno bi bio protumačen kao
 * množina.
 */
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type IsPluralForms<T> = 'other' extends keyof T
  ? keyof T extends PluralCategory
    ? true
    : false
  : false;

type Widen<T> = T extends string
  ? string
  : IsPluralForms<T> extends true
    ? PluralForms
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof srLatn>;
export type MessagesKey = MessageKey<Messages>;

/**
 * Katalozi se učitavaju dinamički da bi u bundle ušao samo jezik koji se
 * zaista koristi.
 */
const loaders: Record<Locale, () => Promise<{ default: MessageTree }>> = {
  'sr-Latn': async () => ({ default: srLatn as unknown as MessageTree }),
  'sr-Cyrl': () => import('./messages/sr-Cyrl'),
  en: () => import('./messages/en'),
  de: () => import('./messages/de'),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  const loaded = await loaders[locale]();
  return loaded.default as Messages;
}

/** Podrazumevani katalog - koristi se kao rezerva za nedostajuće ključeve. */
export const fallbackMessages = srLatn as unknown as MessageTree;
