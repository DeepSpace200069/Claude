import { getSectionDefinition, requireSectionDefinition } from './registry';
import type { InvitationSectionRecord } from './types';

/**
 * Čitanje i migracija podataka sekcije (zahtev 8, 19 i 39.3).
 *
 * Svaka pozivnica pamti verziju šeme za svaku sekciju. Kada se šema promeni,
 * stari podaci prolaze kroz `migrate()` definicije, pa se tek onda validiraju.
 * Zbog toga izmena šeme nikad ne ruši već napravljene pozivnice - a ako podaci
 * ipak nisu ispravni, vraćamo podrazumevani sadržaj umesto da pukne render.
 */
export type SectionReadResult<T = unknown> =
  | { ok: true; data: T; migrated: boolean; version: number }
  | { ok: false; error: string; data: T; version: number };

export function readSectionData<T = unknown>(
  type: string,
  rawData: unknown,
  fromVersion: number,
): SectionReadResult<T> {
  const definition = getSectionDefinition(type);

  // Nepoznat tip nije izuzetak nego podatak: pozivnica napravljena novijom
  // verzijom aplikacije mora da se prikaže i posle rollback-a, bez te sekcije.
  if (!definition) {
    return {
      ok: false,
      error: `Nepoznat tip sekcije: "${type}".`,
      data: undefined as T,
      version: fromVersion,
    };
  }

  const currentVersion = definition.version;

  let candidate = rawData;
  let migrated = false;

  if (fromVersion < currentVersion) {
    if (!definition.migrate) {
      return {
        ok: false,
        error: `Sekcija "${type}" nema migraciju sa verzije ${fromVersion} na ${currentVersion}.`,
        data: definition.getDefaultData() as T,
        version: currentVersion,
      };
    }
    candidate = definition.migrate(rawData, fromVersion);
    migrated = true;
  }

  if (fromVersion > currentVersion) {
    // Podaci su noviji od koda (npr. rollback aplikacije). Ne diramo ih i ne
    // renderujemo pogrešno - vraćamo grešku koju pozivalac loguje.
    return {
      ok: false,
      error: `Sekcija "${type}" je sačuvana verzijom šeme ${fromVersion}, a kod poznaje ${currentVersion}.`,
      data: definition.getDefaultData() as T,
      version: currentVersion,
    };
  }

  const parsed = definition.schema.safeParse(candidate);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(koren)'}: ${issue.message}`)
        .join('; '),
      data: definition.getDefaultData() as T,
      version: currentVersion,
    };
  }

  return { ok: true, data: parsed.data as T, migrated, version: currentVersion };
}

/** Validacija pri upisu - ovde greška mora da putuje do korisnika. */
export function validateSectionData(
  type: string,
  data: unknown,
): { ok: true; data: unknown } | { ok: false; fieldErrors: Record<string, string> } {
  const definition = requireSectionDefinition(type);
  const parsed = definition.schema.safeParse(data);

  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_';
    fieldErrors[path] ??= issue.message;
  }

  return { ok: false, fieldErrors };
}

/**
 * Priprema sekcije za prikaz.
 *
 * Nevalidne sekcije se preskaču umesto da obore celu stranicu: gost mora da
 * vidi pozivnicu čak i ako je jedna sekcija oštećena.
 */
export function prepareSectionsForRender(
  sections: readonly InvitationSectionRecord[],
  onError?: (sectionId: string, error: string) => void,
): Array<InvitationSectionRecord & { data: unknown }> {
  return sections
    .filter((section) => section.isVisible)
    .sort((a, b) => a.position - b.position)
    .flatMap((section) => {
      const result = readSectionData(
        section.type,
        section.data,
        section.schemaVersion,
      );

      if (!result.ok) {
        onError?.(section.id, result.error);
        return [];
      }

      return [{ ...section, data: result.data, schemaVersion: result.version }];
    });
}
