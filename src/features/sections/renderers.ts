import type { SectionRendererComponent } from './types';

import { CalendarRenderer } from './renderers/calendar';
import { ContactRenderer } from './renderers/contact';
import { CountdownRenderer } from './renderers/countdown';
import { CustomContentRenderer } from './renderers/custom-content';
import { DateTimeRenderer } from './renderers/date-time';
import { FooterRenderer } from './renderers/footer';
import { GalleryRenderer } from './renderers/gallery';
import { GuestbookRenderer } from './renderers/guestbook';
import { HeroRenderer } from './renderers/hero';
import { InfoCardsRenderer } from './renderers/info-cards';
import { LocationsRenderer } from './renderers/locations';
import { MessageRenderer } from './renderers/message';
import { MusicRenderer } from './renderers/music';
import { NamesRenderer } from './renderers/names';
import { PeopleRenderer } from './renderers/people';
import { RsvpRenderer } from './renderers/rsvp';
import { ScheduleRenderer } from './renderers/schedule';
import { StoryRenderer } from './renderers/story';

/**
 * Registar renderera (zahtev 39.10).
 *
 * Odvojen je od `registry.ts` namerno. Definicije sekcija (šeme, podrazumevani
 * podaci, migracije) uvoze i server, i uređivač, i javna stranica. Komponente
 * su drugačija priča: javna stranica sme da povuče **samo** renderere, nikad
 * editore. Da su svi na istom objektu, jedan `import` bi doneo ceo uređivač u
 * bundle koji gost učitava sa telefona.
 *
 * Većina renderera su server komponente bez ijednog bajta JavaScripta na
 * klijentu; `'use client'` nose samo one kojima interaktivnost zaista treba
 * (odbrojavanje, galerija sa lightboxom, muzika).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Record<string, SectionRendererComponent<any>> = {
  hero: HeroRenderer,
  names: NamesRenderer,
  date_time: DateTimeRenderer,
  countdown: CountdownRenderer,
  message: MessageRenderer,
  calendar: CalendarRenderer,
  locations: LocationsRenderer,
  schedule: ScheduleRenderer,
  info_cards: InfoCardsRenderer,
  people: PeopleRenderer,
  gallery: GalleryRenderer,
  story: StoryRenderer,
  music: MusicRenderer,
  rsvp: RsvpRenderer,
  guestbook: GuestbookRenderer,
  contact: ContactRenderer,
  custom_content: CustomContentRenderer,
  footer: FooterRenderer,
};

export function getSectionRenderer(
  type: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): SectionRendererComponent<any> | undefined {
  return RENDERERS[type];
}

/** Tipovi koji imaju renderer - koristi se u testu potpunosti registra. */
export const RENDERABLE_SECTION_TYPES: readonly string[] = Object.keys(RENDERERS);
