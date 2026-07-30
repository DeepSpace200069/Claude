import { z } from 'zod';

/**
 * Knjiga želja (zahtev 9).
 *
 * Poruka je čist tekst - bez HTML-a i bez ijedne oznake koja bi se izvršila u
 * pregledaču drugog gosta. Renderer je ispisuje kao tekst, pa ni sadržaj koji
 * liči na oznaku ne može ništa (zahtev 24, „custom HTML nije dozvoljen").
 */
export const guestbookEntrySchema = z.object({
  slug: z.string().trim().min(3).max(60),
  authorName: z.string().trim().min(2, 'Unesite svoje ime.').max(80),
  message: z.string().trim().min(2, 'Napišite poruku.').max(2000),
  /** Emodži reakcija iz ponuđenog skupa; slobodan unos se odbija. */
  reaction: z.string().trim().max(8).default(''),
  nonce: z.string().min(1).max(200),
  /** Polje-mamac; vidi `rsvpSubmissionSchema`. */
  companyName: z.string().max(200).default(''),
});

export type GuestbookFormValues = z.input<typeof guestbookEntrySchema>;
export type GuestbookEntryInput = z.output<typeof guestbookEntrySchema>;

/** Ponuđene reakcije - konačan skup, da se kroz „emodži" ne unese tekst. */
export const GUESTBOOK_REACTIONS = ['❤️', '🎉', '🥂', '👏', '🌸'] as const;

export const moderateEntrySchema = z.object({
  eventId: z.uuid(),
  entryId: z.uuid(),
  status: z.enum(['approved', 'hidden']),
});

export const deleteEntrySchema = z.object({
  eventId: z.uuid(),
  entryId: z.uuid(),
});
