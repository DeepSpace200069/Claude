import { LOCALE_META, type Locale } from './config';

/**
 * Formatiranje datuma, vremena i brojeva po izabranom jeziku (zahtev 4).
 *
 * Svi događaji se čuvaju kao `timestamptz`, a prikazuju u vremenskoj zoni
 * događaja - gost u Beču i gost u Beogradu moraju videti isto vreme početka.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Belgrade';

type FormatOptions = { timeZone?: string };

export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions & FormatOptions = {},
): string {
  const { timeZone = DEFAULT_TIME_ZONE, ...rest } = options;
  return new Intl.DateTimeFormat(LOCALE_META[locale].intlTag, {
    dateStyle: 'long',
    timeZone,
    ...rest,
  }).format(date);
}

export function formatTime(
  date: Date,
  locale: Locale,
  options: FormatOptions = {},
): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intlTag, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(
  date: Date,
  locale: Locale,
  options: FormatOptions = {},
): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intlTag, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
  }).format(date);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(LOCALE_META[locale].intlTag, options).format(
    value,
  );
}

export function formatCurrency(
  amountMinor: number,
  currency: string,
  locale: Locale,
): string {
  return new Intl.NumberFormat(LOCALE_META[locale].intlTag, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'RSD' ? 0 : 2,
  }).format(amountMinor / 100);
}

/**
 * Broj punih dana između dva trenutka, računat po kalendarskim danima u
 * zadatoj vremenskoj zoni (odbrojavanje do događaja ne sme da "preskoči" dan
 * zbog razlike u satima).
 */
export function daysUntil(
  target: Date,
  from: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  const toParts = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return Date.parse(`${formatter.format(date)}T00:00:00Z`);
  };

  const diffMs = toParts(target) - toParts(from);
  return Math.round(diffMs / 86_400_000);
}

/** Relativan opis vremena ("za 3 dana", "pre 2 sata"). */
export function formatRelative(target: Date, locale: Locale, from = new Date()): string {
  const formatter = new Intl.RelativeTimeFormat(LOCALE_META[locale].intlTag, {
    numeric: 'auto',
  });
  const diffSeconds = Math.round((target.getTime() - from.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(diffSeconds, 'second');
}
