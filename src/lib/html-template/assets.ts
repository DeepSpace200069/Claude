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

/**
 * Tipovi sadržaja koje šablon sme da nosi.
 *
 * Namerno allowlist i namerno **jedan** spisak za obe strane: uvoznik odbija
 * fajl koji nije na njemu, a ruta odbija zahtev za takvim fajlom. Da su dva
 * spiska, razišli bi se, i to tiho.
 */
export const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  txt: 'text/plain; charset=utf-8',
};

/** Ekstenzija bez tačke, malim slovima; bez `node:path`, jer radi i u pregledaču. */
export function extensionOf(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

export function contentTypeOf(filePath: string): string | null {
  return CONTENT_TYPES[extensionOf(filePath)] ?? null;
}

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
