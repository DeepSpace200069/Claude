'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { profileSchema } from '@/features/profile/schema';
import { LOCALE_COOKIE } from '@/i18n/config';
import { requireUser } from '@/server/authz';
import { updateUserProfile } from '@/server/services/profile';

import { failure, success, toActionFailure, zodFieldErrors, type ActionResult } from './result';

export type { ProfileInput } from '@/features/profile/schema';

/** Čuvanje profila; jezik se odmah primenjuje i na tekuću sesiju. */
export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  try {
    const user = await requireUser();

    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await updateUserProfile(user.id, {
      name: parsed.data.name.trim() || null,
      locale: parsed.data.locale,
      rsvpNotifications: parsed.data.rsvpNotifications,
    });

    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    revalidatePath('/app/profil');

    return success({ saved: true });
  } catch (error) {
    return toActionFailure(error);
  }
}
