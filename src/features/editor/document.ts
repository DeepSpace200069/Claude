import {
  getSectionDefinition,
  isSingleton,
  requireSectionDefinition,
} from '@/features/sections/registry';
import { readSectionData } from '@/features/sections/migrate';
import type { ThemeTokens } from '@/features/themes/tokens';
import { newId } from '@/lib/uuid';

/**
 * Model dokumenta koji uređivač drži u ruci (zahtev 8 i 39.4).
 *
 * Ovo je **isti** oblik koji renderer prikazuje i koji server upisuje - nema
 * odvojene „editorske" strukture koja bi mogla da se raziđe od onoga što gost
 * vidi. Sve operacije su čiste funkcije nad nepromenljivim dokumentom: undo i
 * redo su zbog toga obična istorija vrednosti, bez ijedne inverzne operacije.
 */

export type EditorSection = {
  /** UUID; klijent ga pravi za nove sekcije, pa ostaje stabilan i posle čuvanja. */
  id: string;
  type: string;
  schemaVersion: number;
  position: number;
  isVisible: boolean;
  data: unknown;
};

export type EditorDocument = {
  theme: ThemeTokens;
  sections: EditorSection[];
};

/** Sekcija onako kako je zapisana u verziji šablona. */
export type TemplateSectionInput = {
  type: string;
  schemaVersion: number;
  position: number;
  isVisible: boolean;
  data: unknown;
};

// --- Pomoćne funkcije -------------------------------------------------------

/**
 * Poređenje po vrednosti.
 *
 * Potrebno je da bismo znali da li je korisnik uopšte nešto uneo u sekciju
 * (`isDefaultData`) i da li je dokument izmenjen. Podaci sekcija su čist JSON
 * (Zod ih tako i validira), pa je rekurzivno poređenje dovoljno i predvidivo.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      deepEqual(left[key], right[key]),
  );
}

/** Redosled u nizu je izvor istine; `position` se izvodi iz njega. */
export function normalizePositions(sections: readonly EditorSection[]): EditorSection[] {
  return sections.map((section, index) =>
    section.position === index ? section : { ...section, position: index },
  );
}

export function findSection(
  document: EditorDocument,
  sectionId: string,
): EditorSection | null {
  return document.sections.find((section) => section.id === sectionId) ?? null;
}

/** Da li sekcija još uvek sadrži samo podrazumevani sadržaj. */
export function isDefaultData(type: string, data: unknown): boolean {
  const definition = getSectionDefinition(type);
  if (!definition) return false;
  return deepEqual(data, definition.getDefaultData());
}

export function documentsEqual(a: EditorDocument, b: EditorDocument): boolean {
  return deepEqual(a, b);
}

// --- Operacije nad sekcijama ------------------------------------------------

export type AddSectionResult =
  | { ok: true; document: EditorDocument; sectionId: string }
  | { ok: false; reason: 'unknown_type' | 'singleton_exists' };

/**
 * Dodavanje sekcije.
 *
 * Vraća razlog odbijanja umesto da baca izuzetak: isti poziv koristi i
 * interfejs (da onemogući stavku u biblioteci) i server (kao stvarna provera).
 */
export function addSection(
  document: EditorDocument,
  type: string,
  atIndex?: number,
): AddSectionResult {
  const definition = getSectionDefinition(type);
  if (!definition) return { ok: false, reason: 'unknown_type' };

  if (
    definition.singleton === true &&
    document.sections.some((section) => section.type === type)
  ) {
    return { ok: false, reason: 'singleton_exists' };
  }

  const section: EditorSection = {
    id: newId(),
    type,
    schemaVersion: definition.version,
    position: 0,
    isVisible: true,
    data: definition.getDefaultData(),
  };

  const next = [...document.sections];
  const index =
    atIndex === undefined
      ? next.length
      : Math.min(Math.max(atIndex, 0), next.length);
  next.splice(index, 0, section);

  return {
    ok: true,
    document: { ...document, sections: normalizePositions(next) },
    sectionId: section.id,
  };
}

export function removeSection(
  document: EditorDocument,
  sectionId: string,
): EditorDocument {
  const next = document.sections.filter((section) => section.id !== sectionId);
  if (next.length === document.sections.length) return document;
  return { ...document, sections: normalizePositions(next) };
}

/**
 * Dupliranje sekcije.
 *
 * Sekcije koje smeju da postoje samo jednom (naslovna, odbrojavanje, RSVP...)
 * se ne dupliraju - kopija bi prošla kroz interfejs, a pukla pri čuvanju.
 */
export function duplicateSection(
  document: EditorDocument,
  sectionId: string,
): { document: EditorDocument; sectionId: string | null } {
  const index = document.sections.findIndex((section) => section.id === sectionId);
  const source = document.sections[index];
  if (!source || isSingleton(source.type)) {
    return { document, sectionId: null };
  }

  const copy: EditorSection = {
    ...source,
    id: newId(),
    // Struktura podataka je čist JSON, pa je duboka kopija bezbedna.
    data: structuredClone(source.data),
  };

  const next = [...document.sections];
  next.splice(index + 1, 0, copy);

  return {
    document: { ...document, sections: normalizePositions(next) },
    sectionId: copy.id,
  };
}

export function moveSection(
  document: EditorDocument,
  sectionId: string,
  toIndex: number,
): EditorDocument {
  const from = document.sections.findIndex((section) => section.id === sectionId);
  if (from < 0) return document;

  const target = Math.min(Math.max(toIndex, 0), document.sections.length - 1);
  if (target === from) return document;

  const next = [...document.sections];
  const [moved] = next.splice(from, 1);
  if (!moved) return document;
  next.splice(target, 0, moved);

  return { ...document, sections: normalizePositions(next) };
}

/** Pomeranje za jedno mesto - koriste ga dugmad koja rade bez miša (zahtev 31). */
export function moveSectionBy(
  document: EditorDocument,
  sectionId: string,
  delta: number,
): EditorDocument {
  const from = document.sections.findIndex((section) => section.id === sectionId);
  if (from < 0) return document;
  return moveSection(document, sectionId, from + delta);
}

export function setSectionVisibility(
  document: EditorDocument,
  sectionId: string,
  isVisible: boolean,
): EditorDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, isVisible } : section,
    ),
  };
}

export function updateSectionData(
  document: EditorDocument,
  sectionId: string,
  data: unknown,
): EditorDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, data } : section,
    ),
  };
}

/** Vraća sekciju na podrazumevani sadržaj, bez brisanja same sekcije. */
export function resetSection(
  document: EditorDocument,
  sectionId: string,
): EditorDocument {
  const section = findSection(document, sectionId);
  if (!section) return document;

  const definition = getSectionDefinition(section.type);
  if (!definition) return document;

  return updateSectionData(document, sectionId, definition.getDefaultData());
}

export function setTheme(
  document: EditorDocument,
  theme: ThemeTokens,
): EditorDocument {
  return { ...document, theme };
}

// --- Šabloni ----------------------------------------------------------------

/**
 * Primena drugog šablona bez gubitka unetih podataka (zahtev 3.12).
 *
 * Pravilo: šablon donosi **raspored i izgled**, korisnik zadržava **sadržaj**.
 * Za svaki tip sekcije koji postoji i u dokumentu i u šablonu preuzimamo
 * korisnikove podatke; sekcije koje je korisnik dodao, a šablon ih nema, ostaju
 * na kraju umesto da nestanu. Prazne sekcije (netaknut podrazumevani sadržaj)
 * ustupaju mesto šablonskim, jer tu korisnik nije izgubio ništa.
 */
export function applyTemplateToDocument(
  document: EditorDocument,
  template: { themeTokens: ThemeTokens; sections: readonly TemplateSectionInput[] },
): EditorDocument {
  const carriedOver = new Map<string, EditorSection[]>();

  for (const section of document.sections) {
    if (isDefaultData(section.type, section.data)) continue;
    const bucket = carriedOver.get(section.type);
    if (bucket) bucket.push(section);
    else carriedOver.set(section.type, [section]);
  }

  const sections: EditorSection[] = [];

  for (const templateSection of [...template.sections].sort(
    (a, b) => a.position - b.position,
  )) {
    const definition = getSectionDefinition(templateSection.type);
    if (!definition) continue;

    const pending = carriedOver.get(templateSection.type);
    const reused = pending?.shift();

    sections.push(
      reused
        ? { ...reused, position: sections.length }
        : {
            id: newId(),
            type: templateSection.type,
            schemaVersion: templateSection.schemaVersion,
            position: sections.length,
            isVisible: templateSection.isVisible,
            data: templateSection.data,
          },
    );
  }

  // Sve što šablon ne pokriva, a korisnik je popunio, ide na kraj.
  for (const remaining of carriedOver.values()) {
    for (const section of remaining) {
      sections.push({ ...section, position: sections.length });
    }
  }

  return { theme: template.themeTokens, sections };
}

/** Sekcije verzije šablona kao dokument - koristi ih i čarobnjak i demo. */
export function documentFromTemplate(template: {
  themeTokens: ThemeTokens;
  sections: readonly TemplateSectionInput[];
}): EditorDocument {
  return applyTemplateToDocument({ theme: template.themeTokens, sections: [] }, template);
}

// --- Validacija -------------------------------------------------------------

export type DocumentIssue = {
  sectionId: string;
  type: string;
  message: string;
};

/**
 * Provera celog dokumenta pre čuvanja.
 *
 * Isti kod se izvršava na klijentu (da korisnik odmah vidi problem) i na
 * serveru (jer klijentska provera nije odbrana) - zahtev 24 i 39.4.
 */
export function validateDocument(document: EditorDocument): DocumentIssue[] {
  const issues: DocumentIssue[] = [];

  for (const section of document.sections) {
    const definition = getSectionDefinition(section.type);

    if (!definition) {
      issues.push({
        sectionId: section.id,
        type: section.type,
        message: `Nepoznat tip sekcije: "${section.type}".`,
      });
      continue;
    }

    const result = definition.schema.safeParse(section.data);
    if (!result.success) {
      const first = result.error.issues[0];
      issues.push({
        sectionId: section.id,
        type: section.type,
        message: first
          ? `${first.path.join('.') || '(koren)'}: ${first.message}`
          : 'Podaci sekcije nisu ispravni.',
      });
    }
  }

  return issues;
}

/**
 * Sekcije iz baze u dokument uređivača.
 *
 * Prolazi kroz istu migraciju kao javni prikaz, pa uređivač i gost vide isti
 * sadržaj čak i kada je pozivnica napravljena starijom verzijom šeme.
 */
export function documentFromRecords(
  theme: ThemeTokens,
  records: ReadonlyArray<{
    id: string;
    type: string;
    schemaVersion: number;
    position: number;
    isVisible: boolean;
    data: unknown;
  }>,
  onIssue?: (sectionId: string, message: string) => void,
): EditorDocument {
  const sections = [...records]
    .sort((a, b) => a.position - b.position)
    .flatMap<EditorSection>((record) => {
      const result = readSectionData(record.type, record.data, record.schemaVersion);

      if (!result.ok) {
        onIssue?.(record.id, result.error);
        // Nepoznat tip nema šta da se prikaže ni uredi - preskačemo ga da
        // uređivač ne bi pao; sadržaj u bazi ostaje netaknut do sledećeg upisa.
        if (!getSectionDefinition(record.type)) return [];
      }

      return [
        {
          id: record.id,
          type: record.type,
          schemaVersion: result.version,
          position: record.position,
          isVisible: record.isVisible,
          data: result.data,
        },
      ];
    });

  return { theme, sections: normalizePositions(sections) };
}

/** Podrazumevani sadržaj za tip sekcije - koristi ga i „resetuj" i biblioteka. */
export function defaultDataFor(type: string): unknown {
  return requireSectionDefinition(type).getDefaultData();
}
