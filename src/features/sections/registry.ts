import type { SectionDefinition } from './types';

import {
  calendarSection,
  contactSection,
  countdownSection,
  customContentSection,
  dateTimeSection,
  footerSection,
  heroSection,
  messageSection,
  namesSection,
} from './definitions/basics';
import {
  infoCardsSection,
  locationsSection,
  peopleSection,
  scheduleSection,
} from './definitions/logistics';
import {
  gallerySection,
  musicSection,
  storySection,
} from './definitions/media';
import { guestbookSection, rsvpSection } from './definitions/interaction';

/**
 * Registar sekcija (zahtev 8 i 39.1).
 *
 * Uređivač ne zna ništa o konkretnim tipovima sekcija - sve što prikazuje
 * dolazi odavde. Dodavanje nove sekcije znači jednu definiciju i jedan unos u
 * ovoj listi; nijedna postojeća komponenta se ne menja.
 *
 * Ovaj modul je namerno bez React komponenti: uvoze ga i server, i uređivač, i
 * javni prikaz pozivnice. Komponente se traže iz odvojenih registara
 * (`renderers.ts`, `editors.ts`) da javna stranica ne bi povukla JavaScript
 * uređivača (zahtev 39.10).
 */
const DEFINITIONS = [
  heroSection,
  namesSection,
  dateTimeSection,
  countdownSection,
  messageSection,
  calendarSection,
  locationsSection,
  scheduleSection,
  infoCardsSection,
  peopleSection,
  gallerySection,
  storySection,
  musicSection,
  rsvpSection,
  guestbookSection,
  contactSection,
  customContentSection,
  footerSection,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as unknown as Array<SectionDefinition<any>>;

const REGISTRY = new Map<string, SectionDefinition<unknown>>(
  DEFINITIONS.map((definition) => [
    definition.type,
    definition as SectionDefinition<unknown>,
  ]),
);

/** Svi registrovani tipovi, redosledom kojim se nude u biblioteci sekcija. */
export const SECTION_TYPES: readonly string[] = DEFINITIONS.map((d) => d.type);

export function getSectionDefinition(
  type: string,
): SectionDefinition<unknown> | undefined {
  return REGISTRY.get(type);
}

/** Definicija ili greška - koristi se tamo gde nepoznat tip znači grešku podataka. */
export function requireSectionDefinition(
  type: string,
): SectionDefinition<unknown> {
  const definition = REGISTRY.get(type);
  if (!definition) {
    throw new Error(`Nepoznat tip sekcije: "${type}".`);
  }
  return definition;
}

export function listSectionDefinitions(): SectionDefinition<unknown>[] {
  return [...REGISTRY.values()];
}

/** Sekcije koje se nude za zadati tip događaja. */
export function listSectionsForEventType(
  eventTypeKey: string,
): SectionDefinition<unknown>[] {
  return listSectionDefinitions().filter(
    (definition) =>
      definition.allowedEventTypes === null ||
      definition.allowedEventTypes.includes(eventTypeKey),
  );
}

/** Sekcije koje smeju da postoje samo jednom u pozivnici. */
export function isSingleton(type: string): boolean {
  return getSectionDefinition(type)?.singleton === true;
}
