import 'server-only';

/**
 * Ograničavanje učestalosti zahteva (zahtev 24).
 *
 * In-memory implementacija je dovoljna za development i jednu instancu. Zbog
 * toga je iza interfejsa: prelazak na Redis/Upstash menja samo ovaj modul.
 * Napomena za produkciju sa više instanci - vidi README, poznata ograničenja.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Povremeno čišćenje istekih ključeva da mapa ne raste neograničeno. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: new Date(resetAt),
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: new Date(existing.resetAt),
  };
}

/** Samo za testove. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const RATE_LIMITS = {
  /** Kreiranje događaja - sprečava automatizovano zatrpavanje baze. */
  createEvent: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** RSVP forma je javna, pa ima najstrožu granicu po IP adresi. */
  rsvpSubmit: { limit: 8, windowMs: 10 * 60 * 1000 },
  guestbookSubmit: { limit: 5, windowMs: 30 * 60 * 1000 },
  uploadTicket: { limit: 60, windowMs: 10 * 60 * 1000 },
  publish: { limit: 20, windowMs: 60 * 60 * 1000 },
  /**
   * Autosave uređivača.
   *
   * Granica je znatno iznad realnog ritma kucanja (izmene se šalju sa
   * odloženim okidanjem, najviše nekoliko puta u minuti), pa pogađa samo petlju
   * u klijentu ili automatizovano zatrpavanje.
   */
  saveInvitation: { limit: 240, windowMs: 10 * 60 * 1000 },
  /**
   * Unos PIN-a na javnoj pozivnici.
   *
   * PIN ima najviše osam cifara, pa je ograničenje broja pokušaja jedina
   * stvarna odbrana od pogađanja: deset pokušaja na petnaest minuta po
   * posetiocu i pozivnici.
   */
  pinAttempt: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Beleženje pregleda javne pozivnice - štiti agregat od naduvavanja. */
  invitationView: { limit: 60, windowMs: 10 * 60 * 1000 },
  /**
   * Uvoz gostiju iz CSV-a.
   *
   * Jedan uvoz upisuje stotine redova odjednom, pa je granica niska: normalan
   * korisnik uveze fajl jednom ili dvaput, a petlja u skripti stane odmah.
   */
  guestImport: { limit: 12, windowMs: 60 * 60 * 1000 },
  /** Pojedinačne izmene spiska gostiju - dovoljno široko za brz ručni unos. */
  guestMutation: { limit: 300, windowMs: 10 * 60 * 1000 },
  /**
   * Pokretanje naplate.
   *
   * Granica je niska namerno: svaki poziv ide provajderu, a ponovljeni pokušaj
   * sa istim paketom ionako vraća **istu** narudžbinu, pa normalnom korisniku
   * ni ne treba više od nekoliko.
   */
  checkout: { limit: 15, windowMs: 60 * 60 * 1000 },
} as const;
