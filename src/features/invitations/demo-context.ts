import type { InvitationRenderContext } from '@/features/sections/types';

/**
 * Kontekst za demo prikaz šablona.
 *
 * Demo mora da izgleda kao prava pozivnica, pa mu trebaju datum, grad i
 * lokacija - podaci koje inače nosi događaj. Vrednosti su izmišljene, ali
 * realistične i srpske (zahtev 35: bez lorem ipsuma).
 *
 * Ako administrator upiše `demoContext` na verziju šablona, on ima prednost;
 * ovo su podrazumevane vrednosti po tipu proslave.
 */
const DEMO_BY_EVENT_TYPE: Record<
  string,
  { city: string; venue: string; monthsAhead: number; hour: number; details: Record<string, unknown> }
> = {
  wedding: {
    city: 'Beograd',
    venue: 'Restoran Dunavski kej',
    monthsAhead: 5,
    hour: 13,
    details: { partner1Name: 'Milica', partner2Name: 'Stefan' },
  },
  wedding_christening: {
    city: 'Novi Sad',
    venue: 'Salaš 137',
    monthsAhead: 6,
    hour: 14,
    details: { partner1Name: 'Jovana', partner2Name: 'Nikola', childName: 'Sofija' },
  },
  christening: {
    city: 'Beograd',
    venue: 'Hram Svetog Save',
    monthsAhead: 3,
    hour: 11,
    details: { childName: 'Dunja', parentNames: 'Ana i Marko' },
  },
  first_birthday: {
    city: 'Beograd',
    venue: 'Igraonica Balončić',
    monthsAhead: 2,
    hour: 17,
    details: { childName: 'Lena', parentNames: 'Tijana i Vuk' },
  },
  birthday: {
    city: 'Kragujevac',
    venue: 'Restoran Šumadija',
    monthsAhead: 2,
    hour: 19,
    details: { celebrantName: 'Petar', turningAge: 30 },
  },
  coming_of_age: {
    city: 'Novi Sad',
    venue: 'Klub Terasa',
    monthsAhead: 4,
    hour: 21,
    details: { celebrantName: 'Teodora' },
  },
  other: {
    city: 'Beograd',
    venue: 'Porodični dom',
    monthsAhead: 3,
    hour: 18,
    details: { hostNames: 'Porodica Jovanović' },
  },
};

const DEFAULT_TIME_ZONE = 'Europe/Belgrade';

/**
 * Gradi kontekst za demo.
 *
 * `referenceDate` postoji zbog testova: bez njega bi demo datum zavisio od
 * trenutka izvršavanja, pa se snimljeni ispis ne bi mogao porediti.
 */
export function buildDemoContext(
  eventTypeKey: string,
  overrides: Record<string, unknown> | null = null,
  referenceDate: Date = new Date(),
): InvitationRenderContext {
  const preset = DEMO_BY_EVENT_TYPE[eventTypeKey] ?? DEMO_BY_EVENT_TYPE.other!;

  const startsAt = new Date(referenceDate);
  startsAt.setMonth(startsAt.getMonth() + preset.monthsAhead);
  startsAt.setHours(preset.hour, 0, 0, 0);

  const base: InvitationRenderContext = {
    mode: 'preview',
    eventTypeKey,
    startsAt: startsAt.toISOString(),
    timeZone: DEFAULT_TIME_ZONE,
    city: preset.city,
    venueName: preset.venue,
    details: preset.details,
    // Demo šabloni nemaju otpremljene fotografije: sekcije sa slikama same
    // izostavljaju prazna mesta umesto da prikazuju rupe.
    media: {},
  };

  if (!overrides) return base;

  return {
    ...base,
    ...(typeof overrides.city === 'string' ? { city: overrides.city } : {}),
    ...(typeof overrides.venueName === 'string'
      ? { venueName: overrides.venueName }
      : {}),
    ...(typeof overrides.startsAt === 'string'
      ? { startsAt: overrides.startsAt }
      : {}),
    ...(typeof overrides.timeZone === 'string'
      ? { timeZone: overrides.timeZone }
      : {}),
    details: {
      ...base.details,
      ...(typeof overrides.details === 'object' && overrides.details !== null
        ? (overrides.details as Record<string, unknown>)
        : {}),
    },
  };
}
