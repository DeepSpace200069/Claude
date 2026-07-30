import type { z } from 'zod';

import type { EditorDocument } from '@/features/editor/document';
import { guestbookSection, rsvpSection } from '@/features/sections/definitions/interaction';

/**
 * Čitanje podešavanja interaktivnih sekcija sa servera.
 *
 * Server akcija ne sme da veruje klijentu koja su polja tražena, koliki je rok
 * ni da li se poruke moderiraju - to piše u sekciji koju je organizator
 * podesio. Zato se ovde uzima **iz dokumenta pozivnice**, kroz istu Zod šemu
 * koju koristi i uređivač (zahtev 39.4).
 *
 * Sekcija koja je sakrivena (`isVisible === false`) ne postoji za gosta, pa je
 * ovde nema - slanje na sakrivenu formu se odbija.
 */
export type RsvpSectionData = z.infer<typeof rsvpSection.schema>;
export type GuestbookSectionData = z.infer<typeof guestbookSection.schema>;

export function readRsvpSection(document: EditorDocument): RsvpSectionData | null {
  return readSection(document, 'rsvp', rsvpSection.schema);
}

export function readGuestbookSection(
  document: EditorDocument,
): GuestbookSectionData | null {
  return readSection(document, 'guestbook', guestbookSection.schema);
}

function readSection<T>(
  document: EditorDocument,
  type: string,
  schema: z.ZodType<T>,
): T | null {
  const section = document.sections.find(
    (candidate) => candidate.type === type && candidate.isVisible,
  );
  if (!section) return null;

  const parsed = schema.safeParse(section.data);
  return parsed.success ? parsed.data : null;
}
