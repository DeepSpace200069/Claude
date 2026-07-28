import 'server-only';

import { eq } from 'drizzle-orm';

import { randomSlugSuffix } from '@/lib/ids';
import {
  buildSlugCandidate,
  isReservedSlug,
  isValidSlug,
  nextSlugCandidate,
} from '@/lib/slug';
import { db, type Database } from '@/server/db';
import { invitations } from '@/server/db/schema';

/**
 * Rezervacija javnog sluga (zahtev 21).
 *
 * Jedinstvenost se **ne** proverava upitom pa upisom: dva istovremena zahteva
 * bi prošla oba. Umesto toga se oslanjamo na `UNIQUE` indeks i hvatamo grešku
 * 23505, pa probamo sledeći kandidat. Baza je jedini arbitar.
 */
const UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 12;

/**
 * Prepoznaje kršenje `UNIQUE` ograničenja.
 *
 * Drizzle omotava originalnu grešku drajvera, pa `code` nije na vrhu nego u
 * lancu `cause`. Bez prolaska kroz taj lanac rezervacija sluga bi se ponašala
 * kao da je nastupila nepoznata greška i pukla umesto da proba sledeći kandidat.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      (current as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return true;
    }

    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : null;
  }

  return false;
}

export type SlugClaim = {
  slug: string;
  attempts: number;
};

/**
 * Upisuje pozivnicu sa slobodnim slugom.
 *
 * `insert` prima funkciju da bi kompletan upis (uključujući ostala polja)
 * ostao u istoj transakciji sa rezervacijom - slug nikad ne postoji bez reda
 * kome pripada.
 */
export async function insertWithUniqueSlug<T>(
  desiredTitle: string,
  insert: (slug: string) => Promise<T>,
  options: { fallback?: string } = {},
): Promise<{ result: T; claim: SlugClaim }> {
  const base = buildSlugCandidate(desiredTitle, options.fallback ?? 'pozivnica');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt === 0 ? base : nextSlugCandidate(base, attempt, randomSlugSuffix);

    if (isReservedSlug(candidate) || !isValidSlug(candidate)) continue;

    try {
      const result = await insert(candidate);
      return { result, claim: { slug: candidate, attempts: attempt + 1 } };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error(
    'Nije moguće rezervisati jedinstven link pozivnice. Pokušajte sa drugim naslovom.',
  );
}

export type SlugChangeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'reserved' | 'taken' };

/**
 * Kontrolisana promena sluga (zahtev 21).
 *
 * Promena je namerno odvojena operacija sa sopstvenim proverama: javni link je
 * već podeljen gostima, pa se ne sme menjati usput, uz izmenu sadržaja.
 */
export async function changeInvitationSlug(
  invitationId: string,
  nextSlug: string,
  client: Database = db,
): Promise<SlugChangeResult> {
  const normalized = nextSlug.trim().toLowerCase();

  if (!isValidSlug(normalized)) return { ok: false, reason: 'invalid' };
  if (isReservedSlug(normalized)) return { ok: false, reason: 'reserved' };

  try {
    await client
      .update(invitations)
      .set({ publicSlug: normalized })
      .where(eq(invitations.id, invitationId));
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'taken' };
    throw error;
  }
}
