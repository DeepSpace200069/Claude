import 'server-only';

import { forbidden, notFound, redirect } from 'next/navigation';

import {
  getCurrentUser,
  requireEventAccess,
  type CurrentUser,
  type EventAccess,
} from './index';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from './errors';
import type { Permission } from './permissions';

/**
 * Autorizacija za *stranice* (server komponente).
 *
 * Server akcije rade sa tipiziranim greškama jer njihov rezultat ide u formu.
 * Stranica, međutim, treba da vrati odgovarajući HTTP status: 404 za nepostojeći
 * ili tuđi sadržaj, 403 za nedovoljne dozvole i preusmerenje na prijavu za
 * neprijavljenog korisnika. Ova funkcija prevodi jedno u drugo, da nijedna
 * stranica ne bi završila u generičkoj granici greške (zahtev 30 i 39.5).
 */
/**
 * Prijavljeni korisnik na stranici, ili preusmerenje na prijavu.
 *
 * Layout već štiti `/app`, ali stranica i layout se renderuju paralelno, pa bi
 * `requireUser()` u stranici bacio izuzetak dok layout preusmerava. Rezultat je
 * ispravan, ali log pun lažnih grešaka - zato stranice koriste ovu funkciju.
 */
export async function requireUserPage(callbackUrl: string): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return user;
}

export async function requireEventPageAccess(
  eventId: string,
  permission: Permission,
): Promise<EventAccess> {
  try {
    return await requireEventAccess(eventId, permission);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(`/login?callbackUrl=${encodeURIComponent(`/app/dogadjaji/${eventId}`)}`);
    }

    // Tuđi događaj namerno izgleda isto kao nepostojeći (zaštita od IDOR-a).
    if (error instanceof NotFoundError) notFound();

    if (error instanceof AuthorizationError) forbidden();

    throw error;
  }
}
