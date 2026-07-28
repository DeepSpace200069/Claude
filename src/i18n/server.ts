import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  resolveLocale,
  type Locale,
} from './config';
import { fallbackMessages, loadMessages, type Messages } from './messages';
import { createTranslator, type Translator } from './translator';

/**
 * Određuje jezik zahteva.
 *
 * Redosled: eksplicitan izbor u kolačiću -> `Accept-Language` zaglavlje ->
 * podrazumevani jezik. Korisnički profil postavlja kolačić pri prijavi, pa
 * prijavljeni korisnik uvek dobija svoj izbor.
 *
 * `cache()` osigurava jedno izračunavanje po zahtevu.
 */
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  try {
    const headerStore = await headers();
    return resolveLocale(headerStore.get('accept-language'));
  } catch {
    return DEFAULT_LOCALE;
  }
});

/** Prevodilac za trenutni zahtev. */
export const getTranslations = cache(
  async (locale?: Locale): Promise<Translator<Messages>> => {
    const resolved = locale ?? (await getRequestLocale());
    const messages = await loadMessages(resolved);
    return createTranslator<Messages>(resolved, messages, fallbackMessages);
  },
);

/** Učitava katalog za zadati jezik (npr. za javnu pozivnicu na drugom jeziku). */
export async function getMessagesFor(locale: Locale): Promise<Messages> {
  return loadMessages(locale);
}
