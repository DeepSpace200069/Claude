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
} as const;
