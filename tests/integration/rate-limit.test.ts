import { beforeEach, describe, expect, it } from 'vitest';

import {
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  pruneRateLimits,
  type RateLimitStore,
} from '@/server/rate-limit';
import { db } from '@/server/db';
import { rateLimits } from '@/server/db/schema';

import { hasTestDatabase, truncateAll } from './helpers';

/**
 * Ograničavanje učestalosti (zahtev 24).
 *
 * Isti paket testova se izvršava nad oba skladišta - zato što ona **ne smeju**
 * da se ponašaju različito. Skladište nad bazom se dodatno proverava na ono
 * zbog čega i postoji: istovremene zahteve i važenje između instanci.
 */
describe.skipIf(!hasTestDatabase)('ograničavanje učestalosti', () => {
  const stores: Array<[string, () => RateLimitStore]> = [
    ['memory', () => new MemoryRateLimitStore()],
    ['postgres', () => new PostgresRateLimitStore()],
  ];

  beforeEach(async () => {
    await truncateAll();
  });

  for (const [name, create] of stores) {
    describe(name, () => {
      it('pušta do granice, pa zaustavlja', async () => {
        const store = create();
        const options = { limit: 3, windowMs: 60_000 };

        const results = [];
        for (let i = 0; i < 4; i += 1) {
          results.push(await store.hit('kljuc-a', options));
        }

        expect(results.map((result) => result.allowed)).toEqual([
          true,
          true,
          true,
          false,
        ]);
        expect(results[0]?.remaining).toBe(2);
        expect(results[3]?.remaining).toBe(0);
      });

      it('različiti ključevi imaju odvojene brojače', async () => {
        const store = create();
        const options = { limit: 1, windowMs: 60_000 };

        expect((await store.hit('prvi', options)).allowed).toBe(true);
        expect((await store.hit('drugi', options)).allowed).toBe(true);
        expect((await store.hit('prvi', options)).allowed).toBe(false);
      });

      it('istekao prozor kreće iz početka', async () => {
        const store = create();
        // Prozor koji je istekao pre nego što je i počeo: sledeći zahtev mora
        // da dobije nov brojač, a ne da nasledi stari.
        const expired = { limit: 1, windowMs: -1_000 };

        expect((await store.hit('kljuc-b', expired)).allowed).toBe(true);
        expect((await store.hit('kljuc-b', expired)).allowed).toBe(true);
      });

      it('vraća trenutak isteka prozora', async () => {
        const store = create();
        const before = Date.now();

        const result = await store.hit('kljuc-c', { limit: 5, windowMs: 60_000 });

        expect(result.resetAt.getTime()).toBeGreaterThan(before);
        expect(result.resetAt.getTime()).toBeLessThanOrEqual(before + 61_000);
      });
    });
  }

  describe('skladište nad bazom', () => {
    it('istovremeni zahtevi ne probijaju granicu', async () => {
      const store = new PostgresRateLimitStore();
      const options = { limit: 5, windowMs: 60_000 };

      // Deset zahteva odjednom, kao dve instance koje istovremeno primaju
      // saobraćaj. Bez atomičnog upisa bi ih prošlo više od pet.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.hit('istovremeno', options)),
      );

      expect(results.filter((result) => result.allowed)).toHaveLength(5);
    });

    it('brojač važi između instanci', async () => {
      const options = { limit: 2, windowMs: 60_000 };

      // Dve instance klase stoje umesto dva procesa: stanje je u bazi, pa druga
      // instanca nastavlja tamo gde je prva stala.
      const prva = new PostgresRateLimitStore();
      const druga = new PostgresRateLimitStore();

      expect((await prva.hit('deljeno', options)).allowed).toBe(true);
      expect((await druga.hit('deljeno', options)).allowed).toBe(true);
      expect((await prva.hit('deljeno', options)).allowed).toBe(false);
    });

    it('brisanje istekih redova ne dira aktivne', async () => {
      const store = new PostgresRateLimitStore();

      await store.hit('aktivan', { limit: 5, windowMs: 60_000 });
      await store.hit('istekao', { limit: 5, windowMs: -1_000 });

      const removed = await pruneRateLimits();
      expect(removed).toBe(1);

      const rows = await db.select({ key: rateLimits.key }).from(rateLimits);
      expect(rows.map((row) => row.key)).toEqual(['aktivan']);
    });
  });
});
