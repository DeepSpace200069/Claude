import { z } from 'zod';

import { defineSection } from '../types';
import { headingSchema, paragraphSchema } from '../shared-schemas';

/** Sekcije kroz koje gost nešto radi: potvrda dolaska i knjiga želja. */

// --- RSVP -------------------------------------------------------------------

const rsvpSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  /** Rok do kog se prima odgovor; posle njega forma prikazuje poruku. */
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  deadlineNote: z.string().trim().max(200).default(''),

  askChildren: z.boolean().default(true),
  askCompanionNames: z.boolean().default(false),
  askMessage: z.boolean().default(true),
  /** Gost može da unese kontakt da bi kasnije izmenio odgovor. */
  askContact: z.boolean().default(false),
  allowMaybe: z.boolean().default(true),

  /**
   * Dodatna pitanja žive u tabeli `rsvp_questions`, a ne ovde: organizator ih
   * uređuje na stranici gostiju, a odgovori moraju da se pretražuju i izvoze,
   * što JSONB u sekciji ne bi podržao razumno.
   */
  confirmationMessage: paragraphSchema.default(''),
});

export const rsvpSection = defineSection({
  type: 'rsvp',
  version: 1,
  labelKey: 'sections.rsvp.label',
  descriptionKey: 'sections.rsvp.description',
  icon: 'clipboard-check',
  category: 'interaction',
  schema: rsvpSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => rsvpSchema.parse({}),
});

// --- Knjiga želja -----------------------------------------------------------

const guestbookSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  /** Poruke se podrazumevano odobravaju pre javnog prikaza (zahtev 9). */
  requireApproval: z.boolean().default(true),
  showPublicly: z.boolean().default(true),
  allowReactions: z.boolean().default(true),
  maxMessageLength: z.number().int().min(100).max(2000).default(500),
});

export const guestbookSection = defineSection({
  type: 'guestbook',
  version: 1,
  labelKey: 'sections.guestbook.label',
  descriptionKey: 'sections.guestbook.description',
  icon: 'pen-line',
  category: 'interaction',
  schema: guestbookSchema,
  singleton: true,
  requiresFeature: 'guestbook',
  allowedEventTypes: null,
  getDefaultData: () => guestbookSchema.parse({}),
});
