/**
 * Adrese fajlova HTML šablona (zahtev 39.3 i 39.4).
 *
 * Fajlovi uvezenog sajta se **ne** serviraju sa storage hosta nego preko naše
 * rute. Razlog je politika sadržaja: `script-src 'self'` znači da skripta sa
 * S3 domena ne bi radila u produkciji, a radila bi u razvoju gde je storage
 * lokalni folder - greška koja se otkriva tek posle deploya.
 *
 * Adresa nosi id **verzije** šablona, a ne šablona: verzija je nepromenljiva,
 * pa fajlovi mogu da se keširaju zauvek. Nova verzija donosi nove adrese i time
 * i novo keširanje, bez ijednog pitanja o invalidaciji.
 */

export const TEMPLATE_ASSET_BASE = '/sabloni-fajlovi';

/** Prefiks pod kojim fajlovi jedne verzije žive u storage-u. */
export function templateAssetPrefix(versionId: string): string {
  return `sabloni/${versionId}`;
}

export function templateAssetStorageKey(versionId: string, path: string): string {
  return `${templateAssetPrefix(versionId)}/${path}`;
}

/**
 * URL sa kog pregledač povlači fajl.
 *
 * Svaki segment putanje se kodira zasebno da bi kosa crta ostala kosa crta -
 * `encodeURIComponent` nad celom putanjom bi je pretvorio u `%2F`.
 */
export function templateAssetUrl(versionId: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${TEMPLATE_ASSET_BASE}/${versionId}/${encoded}`;
}
