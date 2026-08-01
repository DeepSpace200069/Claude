import { renderHtmlTemplate } from '@/lib/html-template/tokens';

import {
  defaultFieldValues,
  type FieldDefinitions,
  type FieldValues,
} from './html-schema';

/**
 * Vrednosti polja → gotov dokument (zahtev 39.4).
 *
 * Isti modul koriste tri strane: živi pregled u uređivaču, javna pozivnica i
 * demo prikaz šablona. Zbog toga ovde nema ničega serverskog - da bi pregled u
 * pregledaču pokazivao **tačno** ono što gost dobija, a ne približno.
 *
 * Posao je u dva koraka. Prvo se vrednosti dopune i razreše (slika koja je
 * ključ fotografije postaje URL), pa se tek onda dokument popuni. Podela postoji
 * jer se prvi korak razlikuje po okruženju - u uređivaču se fotografije menjaju
 * bez ponovnog učitavanja stranice - dok je drugi uvek isti.
 */

/** Ključ otpremljene fotografije je UUID; putanja asseta šablona nikad nije. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ValueResolution = {
  /** Putanja fajla šablona → URL sa kog se servira. */
  assetUrl: (path: string) => string;
  /** Ključ otpremljene fotografije → URL; `null` kad fotografija više ne postoji. */
  mediaUrl: (assetId: string) => string | null;
};

/**
 * Šta je vrednost polja tipa `image`.
 *
 * Dve mogućnosti, i obe su legitimne: fotografija koju je organizator otpremio
 * (ključ) ili slika iz samog šablona (putanja). Razlikuju se po obliku, a ne po
 * dodatnom polju - vrednosti su obični stringovi zato što se čuvaju u istom
 * `record`-u kao i tekstovi.
 */
export function isUploadedPhoto(value: string): boolean {
  return UUID.test(value);
}

/**
 * Vrednosti spremne za dokument.
 *
 * Nedostajuće se dopunjuju podrazumevanima iz šablona; prazna vrednost polja
 * koje ima podrazumevanu **ostaje prazna** - organizator koji obriše tekst
 * očekuje da tog teksta nema, a ne da se vrati šablonski.
 */
export function resolveFieldValues(
  definitions: FieldDefinitions,
  values: FieldValues,
  resolution: ValueResolution,
): Record<string, string> {
  const defaults = defaultFieldValues(definitions);
  const resolved: Record<string, string> = {};

  for (const field of definitions.fields) {
    const raw = values[field.key] ?? defaults[field.key] ?? '';

    if (field.type !== 'image' || raw === '') {
      resolved[field.key] = raw;
      continue;
    }

    resolved[field.key] = isUploadedPhoto(raw)
      ? (resolution.mediaUrl(raw) ?? '')
      : resolution.assetUrl(raw);
  }

  return resolved;
}

/** Ceo posao u jednom pozivu: dopuna, razrešavanje, popunjavanje. */
export function renderInvitationHtml(input: {
  document: string;
  definitions: FieldDefinitions;
  values: FieldValues;
  resolution: ValueResolution;
}): string {
  return renderHtmlTemplate(input.document, {
    values: resolveFieldValues(input.definitions, input.values, input.resolution),
    assetUrl: input.resolution.assetUrl,
  });
}
