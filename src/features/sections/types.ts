import type { ComponentType } from 'react';
import type { ZodType } from 'zod';

import type { Locale } from '@/i18n/config';
import type { ThemeTokens } from '@/features/themes/tokens';

/**
 * Modularne sekcije pozivnice (zahtev 8 i 39.1).
 *
 * Uređivač i javni prikaz koriste **isti** validirani model podataka, ali
 * namerno **ne** dele isti bundle: definicija (`SectionDefinition`) sadrži samo
 * podatke i logiku bez React komponenti, dok se `Renderer` i `Editor` traže iz
 * odvojenih registara. Zbog toga javna stranica pozivnice nikad ne učitava
 * JavaScript uređivača (zahtev 32 i 39.10).
 */

/** Ograničenje na tipove događaja; `null` znači „dostupno svuda”. */
export type EventTypeRule = readonly string[] | null;

export type SectionCategory =
  | 'basics'
  | 'logistics'
  | 'story'
  | 'media'
  | 'interaction';

export type SectionDefinition<TData = unknown> = {
  /** Jedinstven, stabilan ključ; upisuje se u bazu i nikad se ne menja. */
  type: string;
  /** Verzija šeme podataka - povećava se pri svakoj nekompatibilnoj izmeni. */
  version: number;
  /** Ključevi prevoda: naziv i opis se nikad ne čuvaju na jednom jeziku. */
  labelKey: string;
  descriptionKey: string;
  /** Naziv ikone iz `lucide-react`. */
  icon: string;
  category: SectionCategory;

  /** Validacija podataka sekcije; koristi se i na klijentu i na serveru. */
  schema: ZodType<TData>;
  /** Podrazumevani sadržaj pri dodavanju sekcije. */
  getDefaultData: () => TData;

  /** Za koje tipove događaja je sekcija ponuđena. */
  allowedEventTypes: EventTypeRule;
  /** Sekcija koja sme da postoji samo jednom u pozivnici (npr. naslovna). */
  singleton?: boolean;
  /** Mogućnost vezana za paket - proverava se kroz entitlement sistem. */
  requiresFeature?: string;

  /**
   * Migracija podataka sa starije verzije šeme.
   *
   * Poziva se pri čitanju pozivnice napravljene pre izmene šeme, tako da
   * postojeće pozivnice nikad ne "puknu" zbog nove verzije (zahtev 19 i 39.3).
   */
  migrate?: (data: unknown, fromVersion: number) => TData;
};

export type SectionRendererProps<TData> = {
  data: TData;
  theme: ThemeTokens;
  locale: Locale;
  /** Redni broj sekcije - koristi se za `aria-labelledby` i za animacije. */
  index: number;
  /** Kontekst događaja koji sekcije često prikazuju (datum, imena, grad). */
  event: InvitationRenderContext;
};

export type InvitationRenderContext = {
  eventTypeKey: string;
  startsAt: string | null;
  timeZone: string;
  city: string | null;
  venueName: string | null;
  details: Record<string, unknown>;
};

export type SectionEditorProps<TData> = {
  data: TData;
  onChange: (next: TData) => void;
  /** Greške validacije po putanji polja (`items.0.title`). */
  errors?: Record<string, string>;
  locale: Locale;
};

export type SectionRendererComponent<TData> = ComponentType<
  SectionRendererProps<TData>
>;

export type SectionEditorComponent<TData> = ComponentType<
  SectionEditorProps<TData>
>;

/** Zapis sekcije onako kako je čuvamo uz pozivnicu. */
export type InvitationSectionRecord = {
  id: string;
  type: string;
  schemaVersion: number;
  position: number;
  isVisible: boolean;
  data: unknown;
};

/**
 * Pomoćna funkcija za definisanje sekcije.
 *
 * Postoji zbog izvođenja tipa: `defineSection` zaključi `TData` iz Zod šeme, pa
 * `getDefaultData` i `migrate` dobijaju tačan tip bez ručnog anotiranja.
 */
export function defineSection<TData>(
  definition: SectionDefinition<TData>,
): SectionDefinition<TData> {
  return definition;
}
