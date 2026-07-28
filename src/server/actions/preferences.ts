'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

import { LOCALE_COOKIE, isLocale } from '@/i18n/config';
import { getCurrentUser } from '@/server/authz';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

/**
 * Postavljanje jezika interfejsa.
 *
 * Kolačić je funkcionalan (ne marketinški), pa ne zahteva pristanak - vidi
 * zahtev 25. Prijavljenom korisniku se izbor pamti i u profilu, da bi ga video
 * i na drugom uređaju.
 */
export async function setLocaleAction(value: string): Promise<void> {
  if (!isLocale(value)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  const user = await getCurrentUser();
  if (user) {
    await db.update(users).set({ locale: value }).where(eq(users.id, user.id));
  }
}
