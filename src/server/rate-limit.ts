import 'server-only';

import { lte, sql } from 'drizzle-orm';

import { getEnv } from '@/lib/env';
import { db } from '@/server/db';
import { rateLimits } from '@/server/db/schema';

/**
 * Ograničavanje učestalosti zahteva (zahtev 24).
 *
 * Brojač je iza interfejsa, jer izbor skladišta menja **tačnost**, a ne samo
 * brzinu: brojač u memoriji procesa važi po instanci, pa sa dva servera iza
 * balansera napadač dobija dvostruko više pokušaja i to tiho. Zato postoji i
 * implementacija nad bazom, koja važi za celu aplikaciju.
 *
 * | Drajver | Kada |
 * |---------|------|
 * | `memory` | jedan proces: razvoj i testovi |
 * | `postgres` | podrazumevano: važi za sve instance |
 *
 * Ključ koji stiže ovamo je već izveden i neprozirn (`rsvp:<slug>:<otisak>`),
 * pa se ni u jednom skladištu ne čuva podatak po kom bi se posetilac prepoznao.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export type RateLimitOptions = { limit: number; windowMs: number };

export interface RateLimitStore {
  readonly name: string;
  hit(key: string, options: RateLimitOptions): Promise<RateLimitResult>;
  /** Samo za testove. */
  reset(): Promise<void>;
}

type Bucket = { count: number; resetAt: number };

/**
 * Brojač u memoriji procesa.
 *
 * Ispravan za jedan proces i bez ijednog upita - zato je i dalje podrazumevan u
 * razvoju. Za više instanci vidi `PostgresRateLimitStore`.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = 'memory';

  private readonly buckets = new Map<string, Bucket>();

  async hit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + options.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
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

  async reset(): Promise<void> {
    this.buckets.clear();
  }

  /** Povremeno čišćenje istekih ključeva da mapa ne raste neograničeno. */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/**
 * Brojač u bazi - važi za sve instance aplikacije.
 *
 * Ceo korak je **jedan** `insert ... on conflict do update`, pa dva istovremena
 * zahteva ne mogu da pročitaju isti broj i oba ga uvećaju na istu vrednost.
 * Provera „da li je prozor istekao” je deo istog upisa, jer bi zasebno čitanje
 * pa pisanje bilo trka koju bismo izgubili baš pod napadom.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  readonly name = 'postgres';

  async hit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const windowSeconds = options.windowMs / 1000;

    const [row] = await db
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        resetAt: sql`now() + make_interval(secs => ${windowSeconds})`,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          // Istekao prozor kreće iz početka; unutar prozora se samo uvećava.
          count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} <= now()
            then now() + make_interval(secs => ${windowSeconds})
            else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    if (!row) {
      // Neočekivano: upis bez rezultata. Propuštamo zahtev umesto da srušimo
      // radnju - ograničavanje učestalosti nije razlog da korisnik ostane bez
      // funkcionalnosti.
      return {
        allowed: true,
        remaining: options.limit - 1,
        resetAt: new Date(Date.now() + options.windowMs),
      };
    }

    return {
      allowed: row.count <= options.limit,
      remaining: Math.max(0, options.limit - row.count),
      resetAt: row.resetAt,
    };
  }

  async reset(): Promise<void> {
    await db.delete(rateLimits);
  }
}

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (store) return store;

  store =
    getEnv().RATE_LIMIT_DRIVER === 'memory'
      ? new MemoryRateLimitStore()
      : new PostgresRateLimitStore();

  return store;
}

/** Zamena skladišta u testovima. */
export function setRateLimitStore(next: RateLimitStore | null): void {
  store = next;
}

export async function rateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  return getRateLimitStore().hit(key, options);
}

/** Samo za testove. */
export async function resetRateLimits(): Promise<void> {
  await getRateLimitStore().reset();
}

/**
 * Brisanje istekih redova.
 *
 * Poziva se iz zadatka održavanja; bez njega bi tabela rasla brojem različitih
 * ključeva, a ne brojem aktivnih posetilaca.
 */
export async function pruneRateLimits(): Promise<number> {
  const removed = await db
    .delete(rateLimits)
    .where(lte(rateLimits.resetAt, new Date()))
    .returning({ key: rateLimits.key });

  return removed.length;
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
  /** Preuzimanje sopstvenih podataka - jedan izvoz čita ceo nalog. */
  dataExport: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;
