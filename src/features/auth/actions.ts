'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { signIn } from '@/server/auth';
import { rateLimit } from '@/server/rate-limit';
import { failure, type ActionFailure } from '@/server/actions/result';

/**
 * Slanje magic linka.
 *
 * Odgovor je namerno isti bez obzira na to da li nalog postoji: različit
 * odgovor bi omogućio nabrajanje korisnika (user enumeration).
 */
const requestSchema = z.object({
  email: z.email().max(160),
  callbackUrl: z.string().startsWith('/').max(512).default('/app/dogadjaji'),
});

const MAGIC_LINK_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

export async function requestMagicLinkAction(
  input: unknown,
): Promise<ActionFailure | void> {
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    return failure('validation', 'Unesite ispravnu email adresu.');
  }

  const headerStore = await headers();
  const clientKey =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // Dve granice: po adresi pošiljaoca i po email adresi - prva sprečava
  // masovno slanje, druga zatrpavanje jednog sandučeta.
  const byIp = await rateLimit(`magic-link:ip:${clientKey}`, MAGIC_LINK_LIMIT);
  const byEmail = await rateLimit(
    `magic-link:email:${parsed.data.email.toLowerCase()}`,
    MAGIC_LINK_LIMIT,
  );

  if (!byIp.allowed || !byEmail.allowed) {
    return failure(
      'rate_limited',
      'Poslali smo previše poruka na ovu adresu. Sačekajte petnaestak minuta.',
    );
  }

  try {
    // `signIn` sam preusmerava na stranicu "proverite email".
    await signIn('email', {
      email: parsed.data.email,
      redirectTo: parsed.data.callbackUrl,
    });
  } catch (error) {
    // Next koristi izuzetak za preusmerenje - taj slučaj nije greška.
    if (isRedirectError(error)) throw error;

    console.error('[auth] Slanje magic linka nije uspelo:', error);
    return failure(
      'unknown',
      'Slanje linka trenutno ne radi. Pokušajte ponovo za koji trenutak.',
    );
  }
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const callbackUrl = String(formData.get('callbackUrl') ?? '/app/dogadjaji');
  const safeUrl =
    callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/app/dogadjaji';

  await signIn('google', { redirectTo: safeUrl });
}

/** Next signalizira preusmerenje bacanjem posebne greške. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
