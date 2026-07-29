import { z } from 'zod';

import { themeTokensSchema } from '@/features/themes/tokens';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/server/adapters/storage/types';

/**
 * Oblik zahteva koje uređivač šalje serveru.
 *
 * Iste šeme koristi i klijent (da bi grešku prikazao odmah) i server akcija
 * (kao stvarna provera). Podatak sekcije se ovde ne validira do kraja - to radi
 * registar sekcija, jer samo on zna šemu konkretnog tipa (zahtev 39.4).
 */

export const editorSectionSchema = z.object({
  id: z.uuid(),
  type: z.string().trim().min(1).max(60),
  schemaVersion: z.number().int().min(1).max(1000),
  position: z.number().int().min(0).max(500),
  isVisible: z.boolean(),
  data: z.unknown(),
});

export type EditorSectionInput = z.infer<typeof editorSectionSchema>;

/**
 * Gornja granica broja sekcija u jednom zahtevu.
 *
 * Nije zamena za limit paketa (`maxSections`) - to je poslovno pravilo koje se
 * proverava u servisu. Ovo je zaštita od zahteva koji bi opteretio server pre
 * nego što se do te provere uopšte dođe.
 */
export const MAX_SECTIONS_PER_REQUEST = 100;

export const saveInvitationSchema = z.object({
  eventId: z.uuid(),
  baseRevision: z.number().int().min(1),
  theme: themeTokensSchema,
  sections: z.array(editorSectionSchema).max(MAX_SECTIONS_PER_REQUEST),
});

export type SaveInvitationInput = z.infer<typeof saveInvitationSchema>;

export const switchTemplateSchema = z.object({
  eventId: z.uuid(),
  baseRevision: z.number().int().min(1),
  /** `null` znači „bez šablona": sadržaj ostaje, tema se vraća na podrazumevanu. */
  templateId: z.uuid().nullable(),
  sections: z.array(editorSectionSchema).max(MAX_SECTIONS_PER_REQUEST),
  theme: themeTokensSchema,
});

export const loadRevisionSchema = z.object({
  eventId: z.uuid(),
  revisionId: z.uuid(),
});

// --- Fotografije ------------------------------------------------------------

export const requestUploadSchema = z.object({
  eventId: z.uuid(),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const confirmUploadSchema = z.object({
  eventId: z.uuid(),
  assetId: z.uuid(),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  altText: z.string().trim().max(180).default(''),
  placeholder: z.string().max(4096).nullable().default(null),
});

export const deleteMediaSchema = z.object({
  eventId: z.uuid(),
  assetId: z.uuid(),
});

export const updateMediaAltSchema = z.object({
  eventId: z.uuid(),
  assetId: z.uuid(),
  altText: z.string().trim().max(180),
});
