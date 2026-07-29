'use client';

import dynamic from 'next/dynamic';

import type { SectionEditorComponent } from '@/features/sections/types';

/**
 * Registar editora sekcija (zahtev 3.1 i 39.10).
 *
 * Odvojen od `renderers.ts` i od `registry.ts`. Javna stranica pozivnice uvozi
 * samo renderere; editori se ovde uvoze **lenjo**, pa uređivač pri otvaranju ne
 * povlači kod za svih osamnaest tipova nego samo za onaj koji je izabran.
 *
 * Editori su grupisani po kategoriji, kao i same definicije: rezultat su četiri
 * manja paketa umesto osamnaest sitnih zahteva. Grupa se učita pri prvom
 * otvaranju bilo koje sekcije iz nje, pa se srodne sekcije - koje korisnik
 * ionako uređuje jednu za drugom - dobijaju bez novog čekanja.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = SectionEditorComponent<any>;

const basics = () => import('./editors/basics');
const logistics = () => import('./editors/logistics');
const media = () => import('./editors/media');
const interaction = () => import('./editors/interaction');

/**
 * Editori se **ne** renderuju na serveru.
 *
 * Uređivač je privatna stranica iza prijave: ne indeksira se, ne deli se linkom
 * i ne meri mu se vreme do prvog prikaza kao javnoj pozivnici. Serverski
 * renderovan editor zato ne donosi ništa, a donosi stvaran problem - kada
 * pregledač pri hidraciji još nema učitan lenji deo koda, ume da ostane i
 * serverska i klijentska kopija istog polja u DOM-u. Dva polja sa istim
 * nazivom su smetnja i za čitač ekrana i za automatske testove.
 */
const lazyEditor = (loader: () => Promise<AnyEditor>): AnyEditor =>
  dynamic(loader, { ssr: false });

const EDITORS: Record<string, AnyEditor> = {
  hero: lazyEditor(() => basics().then((module) => module.HeroEditor)),
  names: lazyEditor(() => basics().then((module) => module.NamesEditor)),
  date_time: lazyEditor(() => basics().then((module) => module.DateTimeEditor)),
  countdown: lazyEditor(() => basics().then((module) => module.CountdownEditor)),
  message: lazyEditor(() => basics().then((module) => module.MessageEditor)),
  calendar: lazyEditor(() => basics().then((module) => module.CalendarEditor)),
  contact: lazyEditor(() => basics().then((module) => module.ContactEditor)),
  custom_content: lazyEditor(() =>
    basics().then((module) => module.CustomContentEditor),
  ),
  footer: lazyEditor(() => basics().then((module) => module.FooterEditor)),

  locations: lazyEditor(() => logistics().then((module) => module.LocationsEditor)),
  schedule: lazyEditor(() => logistics().then((module) => module.ScheduleEditor)),
  info_cards: lazyEditor(() => logistics().then((module) => module.InfoCardsEditor)),
  people: lazyEditor(() => logistics().then((module) => module.PeopleEditor)),

  gallery: lazyEditor(() => media().then((module) => module.GalleryEditor)),
  story: lazyEditor(() => media().then((module) => module.StoryEditor)),
  music: lazyEditor(() => media().then((module) => module.MusicEditor)),

  rsvp: lazyEditor(() => interaction().then((module) => module.RsvpEditor)),
  guestbook: lazyEditor(() => interaction().then((module) => module.GuestbookEditor)),
};

export function getSectionEditor(type: string): AnyEditor | undefined {
  return EDITORS[type];
}

/** Tipovi koji imaju editor - koristi se u testu potpunosti registra. */
export const EDITABLE_SECTION_TYPES: readonly string[] = Object.keys(EDITORS);
