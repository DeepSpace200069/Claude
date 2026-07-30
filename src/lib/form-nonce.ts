import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { getEnv } from './env';

/**
 * Potpisani ključ javnih formi (zahtev 24).
 *
 * Javna RSVP forma i knjiga želja nemaju prijavu, pa nemaju ni CSRF token vezan
 * za sesiju. Ovaj ključ radi dve stvari koje su ovde stvarno korisne: dokazuje
 * da je obrazac zaista izdala naša stranica i nosi trenutak izdavanja, pa se
 * odbacuje slanje koje je stiglo brže nego što ijedan čovek može da otkuca ime.
 *
 * Ovo **nije** zamena za CAPTCHA: uporan napadač će jednom učitati stranicu i
 * dobiti ispravan ključ. Zajedno sa poljem-mamcem i ograničenjem po otisku
 * klijenta pokriva automatizovano zatrpavanje, što je realna pretnja pozivnici.
 */
const MIN_AGE_MS = 2_000;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type NonceCheck = 'ok' | 'invalid' | 'too_fast' | 'expired';

export function issueFormNonce(scope: string, now: number = Date.now()): string {
  const payload = `${scope}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export function checkFormNonce(
  scope: string,
  nonce: string,
  now: number = Date.now(),
): NonceCheck {
  const separator = nonce.lastIndexOf('.');
  if (separator <= 0) return 'invalid';

  const payload = nonce.slice(0, separator);
  const signature = nonce.slice(separator + 1);

  if (!verify(payload, signature)) return 'invalid';

  const issuedAt = Number(payload.slice(payload.lastIndexOf('.') + 1));
  if (payload.slice(0, payload.lastIndexOf('.')) !== scope) return 'invalid';
  if (!Number.isFinite(issuedAt)) return 'invalid';

  const age = now - issuedAt;
  if (age < MIN_AGE_MS) return 'too_fast';
  if (age > MAX_AGE_MS) return 'expired';

  return 'ok';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function verify(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * U produkciji `AUTH_SECRET` je obavezan (proverava ga `getEnv`), pa se rezerva
 * koristi samo u razvoju - gde je ionako sve na jednoj mašini.
 */
function secret(): string {
  return getEnv().AUTH_SECRET ?? 'razvojna-tajna-za-potpis-formi';
}
