import { z } from 'zod';

/**
 * Šeme rasporeda sedenja (zahtev 14).
 *
 * Granice (kapacitet, dimenzije, rotacija) postoje i ovde i u servisu. Ovde su
 * zato da forma odmah kaže šta nije u redu; u servisu zato što je on jedini
 * koji zaista odlučuje.
 */
export const TABLE_SHAPES = [
  'round',
  'rectangle',
  'square',
  'oval',
  'head',
  'zone',
] as const;

export type TableShapeValue = (typeof TABLE_SHAPES)[number];

export const PREFERENCE_KINDS = [
  'sit_with',
  'avoid',
  'near_exit',
  'kids_table',
  'high_chair',
  'accessible',
] as const;

const eventScope = { eventId: z.uuid() };

// --- Sale -------------------------------------------------------------------

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  width: z.coerce.number().int().min(400).max(4000),
  height: z.coerce.number().int().min(400).max(4000),
});

export type RoomFormValues = z.input<typeof roomSchema>;

export const createRoomSchema = z.object({
  ...eventScope,
  versionId: z.uuid(),
  room: roomSchema,
});

export const updateRoomSchema = z.object({
  ...eventScope,
  roomId: z.uuid(),
  room: roomSchema,
});

export const deleteRoomSchema = z.object({ ...eventScope, roomId: z.uuid() });

// --- Stolovi ----------------------------------------------------------------

export const tableSchema = z.object({
  name: z.string().trim().min(1).max(60),
  shape: z.enum(TABLE_SHAPES),
  capacity: z.coerce.number().int().min(1).max(40),
  x: z.coerce.number().int().min(-2000).max(6000),
  y: z.coerce.number().int().min(-2000).max(6000),
  width: z.coerce.number().int().min(40).max(800),
  height: z.coerce.number().int().min(40).max(800),
  rotation: z.coerce.number().int().min(-360).max(360),
  notes: z.string().trim().max(300).default(''),
});

export type TableFormValues = z.input<typeof tableSchema>;

export const createTableSchema = z.object({
  ...eventScope,
  roomId: z.uuid(),
  table: tableSchema,
});

export const updateTableSchema = z.object({
  ...eventScope,
  tableId: z.uuid(),
  table: tableSchema,
});

/** Pomeranje se šalje često dok organizator vuče sto, pa nosi samo položaj. */
export const moveTableSchema = z.object({
  ...eventScope,
  tableId: z.uuid(),
  x: z.coerce.number().int().min(-2000).max(6000),
  y: z.coerce.number().int().min(-2000).max(6000),
  rotation: z.coerce.number().int().min(-360).max(360).optional(),
});

export const tableIdSchema = z.object({ ...eventScope, tableId: z.uuid() });

// --- Raspoređivanje ---------------------------------------------------------

export const assignGuestSchema = z.object({
  ...eventScope,
  tableId: z.uuid(),
  guestId: z.uuid(),
  seatNumber: z.coerce.number().int().min(1).max(40).nullable().optional(),
});

export const unassignGuestSchema = z.object({
  ...eventScope,
  assignmentId: z.uuid(),
});

// --- Verzije ----------------------------------------------------------------

export const versionIdSchema = z.object({ ...eventScope, versionId: z.uuid() });

export const duplicateVersionSchema = z.object({
  ...eventScope,
  versionId: z.uuid(),
  label: z.string().trim().max(80).default(''),
});

export const renameVersionSchema = duplicateVersionSchema;

export const setLockSchema = z.object({
  ...eventScope,
  versionId: z.uuid(),
  isLocked: z.boolean(),
});

// --- Preferencije -----------------------------------------------------------

export const addPreferenceSchema = z.object({
  ...eventScope,
  guestId: z.uuid(),
  kind: z.enum(PREFERENCE_KINDS),
  relatedGuestId: z.union([z.uuid(), z.literal('')]).default(''),
  note: z.string().trim().max(200).default(''),
});

export const removePreferenceSchema = z.object({
  ...eventScope,
  preferenceId: z.uuid(),
});
