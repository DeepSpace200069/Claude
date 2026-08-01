import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Nabrojive vrednosti.
 *
 * Sve što je konačan, sistemski definisan skup je Postgres `enum` - baza tako
 * odbija neispravne vrednosti nezavisno od aplikativne validacije.
 * Ono što administrator menja iz panela (tipovi događaja, paketi) su tabele.
 */

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const localeEnum = pgEnum('locale', ['sr-Latn', 'sr-Cyrl', 'en', 'de']);

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'archived',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'draft',
  'published',
  'unpublished',
]);

/** Nivo pristupa saradnika (zahtev 5). */
export const collaboratorRoleEnum = pgEnum('collaborator_role', [
  'editor', // uređuje sadržaj pozivnice
  'guest_manager', // upravlja gostima i odgovorima
  'viewer', // samo pregled
]);

export const collaboratorStatusEnum = pgEnum('collaborator_status', [
  'pending',
  'accepted',
  'revoked',
]);

/** Privatnost javne pozivnice (zahtev 23). */
export const invitationPrivacyEnum = pgEnum('invitation_privacy', [
  'public', // indeksiranje dozvoljeno, svako sa linkom vidi
  'unlisted', // noindex, svako sa linkom vidi
  'pin', // noindex + PIN
  'invite_only', // samo personalizovani linkovi gostiju
]);

export const rsvpStatusEnum = pgEnum('rsvp_status', [
  'pending',
  'yes',
  'no',
  'maybe',
]);

export const rsvpQuestionTypeEnum = pgEnum('rsvp_question_type', [
  'single_choice',
  'multi_choice',
  'boolean',
  'number',
  'text',
  'date',
]);

export const guestbookStatusEnum = pgEnum('guestbook_status', [
  'pending',
  'approved',
  'hidden',
]);

export const templateStatusEnum = pgEnum('template_status', [
  'draft',
  'published',
  'archived',
]);

/**
 * Vrsta šablona (zahtev 7).
 *
 * `sections` je model koji platforma renderuje iz registra sekcija.
 * `html` je gotov jednostrani sajt sa sopstvenim animacijama, koji se **ne**
 * prevodi u sekcije - prevođenje bi uništilo ono zbog čega takav šablon i
 * postoji. Podrazumevana vrednost je `sections`, pa svi postojeći šabloni
 * ostaju netaknuti.
 */
export const templateKindEnum = pgEnum('template_kind', ['sections', 'html']);

export const mediaStatusEnum = pgEnum('media_status', [
  'pending', // izdat je upload URL, fajl još nije potvrđen
  'ready',
  'failed',
]);

export const tableShapeEnum = pgEnum('table_shape', [
  'round',
  'rectangle',
  'square',
  'oval',
  'head', // predsednički sto
  'zone', // zona bez pojedinačnih sedišta
]);

export const guestPreferenceKindEnum = pgEnum('guest_preference_kind', [
  'sit_with',
  'avoid',
  'near_exit',
  'kids_table',
  'high_chair',
  'accessible',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'failed',
  'canceled',
  'refunded',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const promoKindEnum = pgEnum('promo_kind', ['percent', 'fixed', 'free']);

/** Učestalost obaveštenja koju korisnik bira (zahtev 28). */
export const notificationFrequencyEnum = pgEnum('notification_frequency', [
  'immediate',
  'daily',
  'weekly',
  'never',
]);

export const activityKindEnum = pgEnum('activity_kind', [
  'invitation_published',
  'invitation_unpublished',
  'invitation_edited',
  'rsvp_created',
  'rsvp_updated',
  'guest_imported',
  'collaborator_invited',
  'collaborator_accepted',
  'payment_recorded',
  'seating_updated',
]);
