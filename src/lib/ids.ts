import { randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';

/**
 * Kriptografski nepredvidivi identifikatori.
 *
 * RSVP tokeni gostiju moraju biti nepogodivi (zahtev 39.6): koristimo
 * `crypto.randomBytes` i Crockford base32 abecedu bez znakova koji se lako
 * mešaju (I, L, O, U), pa je token lakše pročitati sa papira ili izdiktirati.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Podrazumevana dužina tokena: 26 znakova ≈ 130 bita entropije. */
export const RECIPIENT_TOKEN_LENGTH = 26;

export function randomToken(length = RECIPIENT_TOKEN_LENGTH): string {
  if (length <= 0) throw new Error('Dužina tokena mora biti pozitivna.');

  // Odbacivanje pristrasnosti: 256 nije deljivo sa 32 bez ostatka samo ako
  // abeceda nije stepen dvojke - ovde jeste (32), pa je maskiranje dovoljno.
  const mask = ALPHABET.length - 1;
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[(bytes[i] as number) & mask];
  }
  return out;
}

/** Kratak, čitljiv nasumični sufiks za razrešavanje kolizije slugova. */
export function randomSlugSuffix(length = 5): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}

/** Numerički PIN za zaštićene pozivnice (zahtev 23). */
export function randomPin(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String(randomInt(10));
  return out;
}

/**
 * Poređenje tajni otporno na merenje vremena.
 *
 * Dužine se prvo izjednačavaju heširanjem, jer `timingSafeEqual` baca izuzetak
 * kada baferi nisu iste dužine - a sam izuzetak bi odao dužinu tajne.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Heš tokena za čuvanje u bazi (token se korisniku prikazuje samo jednom). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Idempotency ključ za obradu uplata (zahtev 39.7). */
export function idempotencyKey(): string {
  return randomBytes(24).toString('base64url');
}
