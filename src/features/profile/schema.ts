import { z } from 'zod';

import { LOCALES } from '@/i18n/config';

/** Šema profila; deli je klijentska forma i server akcija. */
export const profileSchema = z.object({
  name: z.string().trim().max(120).or(z.literal('')),
  locale: z.enum(LOCALES),
  rsvpNotifications: z.enum(['immediate', 'daily', 'weekly', 'never']),
});

export type ProfileInput = z.infer<typeof profileSchema>;
