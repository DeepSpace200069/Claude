import 'server-only';

import { eq } from 'drizzle-orm';

import type { Locale } from '@/i18n/config';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  locale: Locale;
  rsvpNotifications: 'immediate' | 'daily' | 'weekly' | 'never';
};

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      locale: users.locale,
      rsvpNotifications: users.rsvpNotifications,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

export async function updateUserProfile(
  userId: string,
  input: {
    name: string | null;
    locale: Locale;
    rsvpNotifications: 'immediate' | 'daily' | 'weekly' | 'never';
  },
): Promise<void> {
  await db
    .update(users)
    .set({
      name: input.name,
      locale: input.locale,
      rsvpNotifications: input.rsvpNotifications,
    })
    .where(eq(users.id, userId));
}
