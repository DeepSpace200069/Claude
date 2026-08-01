import { z } from 'zod';

/**
 * Centralni sistem prava po paketu (zahtev 18 i 39.9).
 *
 * Nijedna komponenta ne sme da ima hardkodovan limit. Sve provere idu kroz
 * `can()` i `limitFor()`, a vrednosti dolaze iz tabele `feature_plans`, pa
 * administrator menja pakete bez izmene koda.
 */

/** Logičke mogućnosti - koriste se i kao `requiresFeature` na sekcijama. */
export const FEATURE_FLAGS = [
  'publish', // javni link uopšte može da se aktivira
  'customQuestions', // dodatna RSVP pitanja
  'seating', // raspored sedenja
  'collaborators', // pozivanje saradnika
  'export', // CSV/PDF izvoz
  'guestbook', // knjiga želja
  'music', // muzička sekcija
  'story', // sekcija „naša priča”
  'customSubdomain', // poddomen ili custom domen
  'removeBranding', // uklanjanje platformskog brendinga
  'allTemplates', // pristup svim šablonima
  'advancedAnalytics',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Brojčani limiti; `null` znači bez ograničenja. */
export const FEATURE_LIMITS = [
  'maxEvents',
  'maxPhotos',
  'maxGuests',
  'maxSections',
  'maxCustomQuestions',
  'maxCollaborators',
  'maxSeatingVersions',
] as const;

export type FeatureLimit = (typeof FEATURE_LIMITS)[number];

export const planFeaturesSchema = z.object({
  flags: z.record(z.enum(FEATURE_FLAGS), z.boolean()),
  limits: z.record(z.enum(FEATURE_LIMITS), z.number().int().min(0).nullable()),
});

export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

/**
 * Podrazumevani paketi.
 *
 * Ovo su vrednosti kojima se baza puni pri seed-u; posle toga izvor istine je
 * baza. Kod ih koristi samo kao rezervu ako paket nije pronađen.
 */
export const DEFAULT_PLANS: Record<
  'free' | 'standard' | 'premium',
  PlanFeatures
> = {
  free: {
    flags: {
      publish: false,
      customQuestions: false,
      seating: false,
      collaborators: false,
      export: false,
      guestbook: false,
      music: false,
      story: true,
      customSubdomain: false,
      removeBranding: false,
      allTemplates: false,
      advancedAnalytics: false,
    },
    limits: {
      maxEvents: 3,
      maxPhotos: 5,
      maxGuests: 0,
      maxSections: 8,
      maxCustomQuestions: 0,
      maxCollaborators: 0,
      maxSeatingVersions: 0,
    },
  },
  standard: {
    flags: {
      publish: true,
      customQuestions: false,
      seating: false,
      collaborators: false,
      export: true,
      guestbook: true,
      music: false,
      story: true,
      customSubdomain: false,
      removeBranding: false,
      allTemplates: false,
      advancedAnalytics: false,
    },
    limits: {
      maxEvents: 10,
      maxPhotos: 30,
      maxGuests: 300,
      maxSections: 16,
      maxCustomQuestions: 3,
      maxCollaborators: 1,
      maxSeatingVersions: 0,
    },
  },
  premium: {
    flags: {
      publish: true,
      customQuestions: true,
      seating: true,
      collaborators: true,
      export: true,
      guestbook: true,
      music: true,
      story: true,
      customSubdomain: true,
      removeBranding: true,
      allTemplates: true,
      advancedAnalytics: true,
    },
    limits: {
      maxEvents: null,
      maxPhotos: 200,
      maxGuests: null,
      maxSections: null,
      maxCustomQuestions: 20,
      maxCollaborators: 10,
      maxSeatingVersions: 5,
    },
  },
};

export type Entitlements = {
  planCode: string;
  planName: string;
  features: PlanFeatures;
};

/** Da li paket dozvoljava određenu mogućnost. */
export function can(entitlements: Entitlements, flag: FeatureFlag): boolean {
  return entitlements.features.flags[flag] === true;
}

/** Paket sveden na ono što određuje hijerarhiju. */
export type PlanRank = { code: string; sortOrder: number };

/**
 * Da li paket pokriva šablon koji traži `requiredPlanCode` (zahtev 7 i 18).
 *
 * Pravilo proizvoda: **izbor** šablona je slobodan dok je pozivnica nacrt -
 * korisnik treba da vidi šta bira i da ima razlog da plati. Tek objavljivanje
 * traži paket koji taj šablon pokriva.
 *
 * Poređenje ide preko `sortOrder`, jer hijerarhiju paketa definiše
 * administrator, a ne redosled slova u kodu. Paket sa `allTemplates` pokriva
 * svaki šablon i bez poređenja - to je smisao te mogućnosti.
 *
 * Nepoznat `requiredPlanCode` (paket obrisan ili preimenovan) namerno **ne**
 * prolazi: to je greška u podacima koja treba glasno da se vidi, a tiho
 * propuštanje bi značilo da premium šablon postane besplatan.
 */
export function planCoversTemplate(
  ranks: readonly PlanRank[],
  entitlements: Entitlements,
  requiredPlanCode: string,
): boolean {
  if (can(entitlements, 'allTemplates')) return true;

  const required = ranks.find((rank) => rank.code === requiredPlanCode);
  if (!required) return false;

  const current = ranks.find((rank) => rank.code === entitlements.planCode);
  if (!current) return false;

  return current.sortOrder >= required.sortOrder;
}

/** Limit za dati resurs; `null` = neograničeno. */
export function limitFor(
  entitlements: Entitlements,
  limit: FeatureLimit,
): number | null {
  const value = entitlements.features.limits[limit];
  return value === undefined ? 0 : value;
}

export type LimitCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; limit: number; current: number };

/**
 * Provera da li se sme dodati još `amount` jedinica resursa.
 *
 * Vraća strukturu umesto da baca izuzetak da bi pozivalac mogao i da onemogući
 * dugme i da prikaže poruku sa tačnim brojem - bez duplog računanja.
 */
export function checkLimit(
  entitlements: Entitlements,
  limit: FeatureLimit,
  current: number,
  amount = 1,
): LimitCheck {
  const max = limitFor(entitlements, limit);
  if (max === null) return { allowed: true, remaining: null };

  if (current + amount > max) {
    return { allowed: false, limit: max, current };
  }

  return { allowed: true, remaining: max - current - amount };
}
