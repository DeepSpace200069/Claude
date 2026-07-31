'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { DELETE_CONFIRMATION } from '@/features/profile/delete-account';
import { requireUser } from '@/server/authz';
import { deleteAccount } from '@/server/services/privacy';

import { failure, success, toActionFailure, type ActionResult } from './result';

/**
 * Privatnost (zahtev 25).
 *
 * Preuzimanje podataka ide kroz rutu za preuzimanje, ne kroz akciju: rezultat je
 * fajl, a ne stanje ekrana. Ovde ostaje brisanje naloga, koje mora da bude
 * potvrđeno ukucanom rečju - jedan pogrešan klik ne sme da obriše proslavu.
 */

const deleteAccountSchema = z.object({
  confirmation: z.string().trim(),
});

export async function deleteAccountAction(
  input: unknown,
): Promise<ActionResult<{ deletedEvents: number }>> {
  try {
    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    const user = await requireUser();

    if (
      parsed.data.confirmation.toLocaleUpperCase('sr-Latn') !== DELETE_CONFIRMATION
    ) {
      return failure('validation', 'Potvrda nije tačna.', {
        fieldErrors: { confirmation: [`Ukucajte ${DELETE_CONFIRMATION}.`] },
      });
    }

    const result = await deleteAccount(user.id);

    // Sesija je obrisana u bazi; kolačić bez sesije nema šta da pokaže, pa ga
    // uklanjamo odmah da korisnik ne ostane na ekranu koji izgleda prijavljeno.
    const store = await cookies();
    for (const name of ['authjs.session-token', '__Secure-authjs.session-token']) {
      if (store.has(name)) store.delete(name);
    }

    return success({ deletedEvents: result.deletedEvents });
  } catch (error) {
    return toActionFailure(error);
  }
}
