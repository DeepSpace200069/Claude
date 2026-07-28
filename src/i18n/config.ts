/**
 * Konfiguracija jezika.
 *
 * Interfejs je primarno na srpskoj latinici, ali je sistem od početka
 * višejezičan (zahtev 4). Locale se čuva u kolačiću i u korisničkom profilu,
 * a javna pozivnica može da ima sopstveni jezik nezavisno od interfejsa.
 */
export const LOCALES = ['sr-Latn', 'sr-Cyrl', 'en', 'de'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'sr-Latn';

export const LOCALE_COOKIE = 'pozivnica_locale';

/** Podaci za prikaz biračа jezika i za `Intl` API. */
export const LOCALE_META: Record<
  Locale,
  { label: string; intlTag: string; htmlLang: string; dir: 'ltr' | 'rtl' }
> = {
  'sr-Latn': {
    label: 'Srpski',
    intlTag: 'sr-Latn-RS',
    htmlLang: 'sr-Latn',
    dir: 'ltr',
  },
  'sr-Cyrl': {
    label: 'Српски',
    intlTag: 'sr-Cyrl-RS',
    htmlLang: 'sr-Cyrl',
    dir: 'ltr',
  },
  en: { label: 'English', intlTag: 'en-GB', htmlLang: 'en', dir: 'ltr' },
  de: { label: 'Deutsch', intlTag: 'de-DE', htmlLang: 'de', dir: 'ltr' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Bira najbolji podržani jezik na osnovu `Accept-Language` zaglavlja.
 *
 * Prvo traži tačno poklapanje (`sr-Latn`), zatim poklapanje po osnovnom jeziku
 * (`sr` -> `sr-Latn`), pa tek onda vraća podrazumevani jezik.
 */
export function resolveLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const quality = qParam ? Number.parseFloat(qParam.split('=')[1] ?? '1') : 1;
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
  }

  for (const { tag } of ranked) {
    const base = tag.split('-')[0]?.toLowerCase();
    if (!base) continue;
    if (base === 'sr') {
      // Srpski bez skripta: latinica je podrazumevana za ovu platformu.
      return tag.toLowerCase().includes('cyrl') ? 'sr-Cyrl' : 'sr-Latn';
    }
    const match = LOCALES.find((l) => l.split('-')[0]?.toLowerCase() === base);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}
