import 'server-only';

import { unstable_cache, updateTag } from 'next/cache';

/**
 * Keširanje kataloga između zahteva (zahtev 32).
 *
 * Šabloni, vrste događaja i paketi menjaju se samo kada administrator nešto
 * objavi ili izmeni - dakle retko - a čitaju se na svakoj poseti galerije,
 * cenovnika i čarobnjaka. React `cache()` pomaže samo unutar jednog zahteva;
 * ovo pamti rezultat i između zahteva, dok ga admin panel ne poništi.
 *
 * Keš je vezan za **oznaku**, ne za vreme: objavljena verzija šablona vidi se
 * odmah, a ne za pet minuta. Vreme je samo gornja granica ako neko izmeni bazu
 * mimo aplikacije.
 */
export const CATALOG_TAG = 'katalog';

/** Gornja granica: sat vremena, za izmene mimo aplikacije (SQL, migracija). */
const CATALOG_TTL_SECONDS = 60 * 60;

/**
 * `unstable_cache` radi samo unutar Next zahteva.
 *
 * Van njega (seed skripta, održavanje, testovi) baca `Invariant:
 * incrementalCache missing`. Keš je ubrzanje, a ne uslov ispravnosti, pa se u
 * tom slučaju čita direktno iz baze - isto rešenje kao kod javne pozivnice.
 */
function isMissingCacheContext(error: unknown): boolean {
  return error instanceof Error && error.message.includes('incrementalCache');
}

export function cachedCatalogRead<Args extends unknown[], Result>(
  key: string,
  read: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await unstable_cache(read, [key], {
        tags: [CATALOG_TAG],
        revalidate: CATALOG_TTL_SECONDS,
      })(...args);
    } catch (error) {
      if (!isMissingCacheContext(error)) throw error;
      return read(...args);
    }
  };
}

/**
 * Poništavanje kataloga posle administrativne izmene.
 *
 * `updateTag`, a ne `revalidateTag`: prvi poništava keš odmah, pa administrator
 * posle objavljivanja šablona vidi novo stanje, a ne ono od pre par sekundi.
 */
export function invalidateCatalog(): void {
  updateTag(CATALOG_TAG);
}
