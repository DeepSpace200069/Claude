/**
 * Zamena za `server-only` paket u testovima.
 *
 * Pravi paket namerno baca grešku kada ga uvuče klijentski bundle. Vitest nema
 * podelu na server i klijent, pa bi svaki modul sa `import 'server-only'` pao
 * pri učitavanju. Alias u `vitest.config.ts` ga zamenjuje ovim praznim modulom -
 * zaštita ostaje aktivna tamo gde ima smisla, u Next build-u.
 */
export {};
