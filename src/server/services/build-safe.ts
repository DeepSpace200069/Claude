import 'server-only';

/**
 * Otpornost `generateStaticParams` na nedostupnu bazu.
 *
 * Next poziva `generateStaticParams` u vreme build-a. Ako baza tada nije
 * dostupna - a na CI-ju ili pri prvom deployu često nije - build bi pao iako sa
 * samim kodom nema ničega. Prazna lista je bezbedan ishod: stranice se tada
 * generišu na zahtev, pri prvoj poseti.
 *
 * Namerno **ne** gutamo greške u samim stranicama: tamo nedostupna baza jeste
 * prava greška i treba da se vidi.
 */
export async function staticParamsOrEmpty<T>(
  load: () => Promise<T[]>,
  context: string,
): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.warn(
      `[build] Preskačem unapred generisanje za "${context}" jer baza nije dostupna. ` +
        'Stranice će se generisati na zahtev. Detalj:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
