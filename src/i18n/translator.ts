import { DEFAULT_LOCALE, LOCALE_META, type Locale } from './config';

/**
 * Minimalni prevodilac sa ICU-like množinom.
 *
 * Namerno ne uvodimo tešku i18n biblioteku: javna stranica pozivnice mora da
 * ostane lagana (zahtev 32/39.10), a potrebe su nam poznate - interpolacija,
 * množina po `Intl.PluralRules` i formatiranje datuma/brojeva po locale-u.
 */

/** Vrednost poruke: običan tekst ili oblici množine. */
export type MessageValue = string | PluralForms;

export type PluralForms = {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type MessageTree = { [key: string]: MessageValue | MessageTree };

/** Rekurzivno gradi uniju dozvoljenih ključeva u obliku "a.b.c". */
export type MessageKey<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends MessageValue
    ? `${Prefix}${K}`
    : T[K] extends MessageTree
      ? MessageKey<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationParams = Record<
  string,
  string | number | boolean | null | undefined
>;

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/**
 * Da li je objekat skup oblika množine.
 *
 * Provera „ima ključ `other`” nije dovoljna: prostor imena `eventTypes` sadrži
 * vrstu proslave `other`, pa bi bio pogrešno protumačen kao množina i sav
 * njegov sadržaj bi postao nedostupan. Zato tražimo da **svi** ključevi budu
 * CLDR kategorije. Isto pravilo važi i na nivou tipova (`src/i18n/messages.ts`).
 */
function isPluralForms(value: unknown): value is PluralForms {
  if (typeof value !== 'object' || value === null) return false;

  const keys = Object.keys(value as Record<string, unknown>);
  return (
    keys.includes('other') &&
    keys.every((key) => (PLURAL_CATEGORIES as readonly string[]).includes(key))
  );
}

function lookup(tree: MessageTree, key: string): MessageValue | undefined {
  const parts = key.split('.');
  let node: MessageValue | MessageTree | undefined = tree;

  for (const part of parts) {
    if (typeof node !== 'object' || node === null || isPluralForms(node)) {
      return undefined;
    }
    node = (node as MessageTree)[part];
    if (node === undefined) return undefined;
  }

  return typeof node === 'string' || isPluralForms(node) ? node : undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function selectPlural(
  forms: PluralForms,
  count: number,
  locale: Locale,
): string {
  const rules = new Intl.PluralRules(LOCALE_META[locale].intlTag);
  const category = rules.select(count) as keyof PluralForms;
  return forms[category] ?? forms.other;
}

export type Translator<T extends MessageTree> = {
  (key: MessageKey<T>, params?: TranslationParams): string;
  locale: Locale;
  /**
   * Prevod ključa koji nije poznat u vreme kompajliranja.
   *
   * Koristi se za nazive koje administrator čuva u bazi (tipovi događaja,
   * sekcije): tamo je ključ podatak, pa provera tipova nije moguća.
   */
  dynamic: (key: string, params?: TranslationParams) => string;
};

/**
 * Pravi funkciju za prevod.
 *
 * Ako ključ ne postoji u traženom jeziku, pada na podrazumevani jezik, pa tek
 * onda vraća sam ključ - tako nedostajući prevod nikada ne ruši stranicu, ali
 * je odmah vidljiv u interfejsu.
 */
export function createTranslator<T extends MessageTree>(
  locale: Locale,
  messages: T,
  fallbackMessages?: MessageTree,
): Translator<T> {
  const translate = (key: MessageKey<T> | string, params: TranslationParams = {}) => {
    const value =
      lookup(messages, key) ??
      (locale === DEFAULT_LOCALE || !fallbackMessages
        ? undefined
        : lookup(fallbackMessages, key));

    if (value === undefined) return key;

    if (isPluralForms(value)) {
      const count = Number(params.count ?? 0);
      return interpolate(selectPlural(value, count, locale), params);
    }

    return interpolate(value, params);
  };

  translate.locale = locale;
  translate.dynamic = (key: string, params: TranslationParams = {}) =>
    translate(key, params);

  return translate as Translator<T>;
}
