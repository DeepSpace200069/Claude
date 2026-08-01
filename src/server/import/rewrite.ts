import {
  isTextAsset,
  resolveReference,
  type SiteFiles,
} from './files';
import { assetToken } from '@/lib/html-template/tokens';

/**
 * Prepisivanje putanja u tekstualnim fajlovima šablona (zahtev 39.3).
 *
 * Uvezen sajt pokazuje sam na sebe relativnim putanjama (`../img/hero.webp`),
 * a posle uvoza njegovi fajlovi žive u storage-u pod sasvim drugom adresom.
 * Ovaj modul te reference prevodi u `{{asset:putanja}}` tokene - jedan oblik
 * koji se kasnije razrešava u pravi URL, bilo pri prikazu (dokument) bilo pri
 * uvozu (CSS i JS koji se serviraju kao fajlovi).
 *
 * Istovremeno se prepisuju i adrese preuzetih spoljnih resursa: `gsap` sa
 * CDN-a je posle uvoza običan fajl šablona, pa `<script src="https://cdn...">`
 * mora da postane token kao i sve ostalo. Bez toga bi provera spoljnih resursa
 * s pravom oborila uvoz.
 */

/** `url(...)` u CSS-u; navodnici su neobavezni. */
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
/** `@import "..."` i `@import url("...")`. */
const CSS_IMPORT = /(@import\s+(?:url\(\s*)?)(["'])([^"']+)\2/gi;
/** Bilo koji string u JS-u; kandidat se prihvata tek ako pokaže na postojeći fajl. */
const JS_STRING = /(["'`])([^"'`\n]{1,300}?)\1/g;

export type ReferenceRewrite = {
  /** Tekst posle prepisivanja. */
  text: string;
  /** Fajlovi šablona na koje ovaj fajl pokazuje. */
  references: Set<string>;
};

/**
 * Zamena adresa preuzetih resursa njihovim putanjama u šablonu.
 *
 * Radi se nad sirovim tekstom, pre svega ostalog: posle ovoga u fajlu više
 * nema nijedne adrese koju smo mi preuzeli, pa se dalje sve svodi na relativne
 * putanje.
 */
export function replaceVendorUrls(
  text: string,
  vendor: ReadonlyArray<{ url: string; path: string }>,
): string {
  let result = text;

  for (const resource of vendor) {
    // Putanja se piše od korena šablona: fajl koji je referencu sadržao može da
    // bude bilo gde u strukturi, a `vendor/gsap.js` bi se inače tražilo pored njega.
    result = result.split(resource.url).join(`/${resource.path}`);
  }

  return result;
}

/**
 * Prepisuje reference jednog CSS fajla (ili `style` atributa).
 *
 * `fromFile` je putanja fajla u kom tekst stoji - bez nje se `../img/x.webp`
 * ne može razrešiti.
 */
export function rewriteCss(
  fromFile: string,
  text: string,
  files: SiteFiles,
): ReferenceRewrite {
  const references = new Set<string>();

  const withUrls = text.replace(CSS_URL, (match, quote: string, url: string) => {
    const target = takeReference(fromFile, url, files, references);
    return target ? `url(${quote}${assetToken(target)}${quote})` : match;
  });

  const withImports = withUrls.replace(
    CSS_IMPORT,
    (match, head: string, quote: string, url: string) => {
      const target = takeReference(fromFile, url, files, references);
      return target ? `${head}${quote}${assetToken(target)}${quote}` : match;
    },
  );

  return { text: withImports, references };
}

/**
 * Prepisuje reference jednog JS fajla.
 *
 * Namerno konzervativno: menja se **samo** string koji se razrešava u fajl koji
 * u šablonu zaista postoji. Sve drugo (ključevi, CSS selektori, tekst) ostaje
 * netaknuto, jer bi svaka šira heuristika menjala tuđi kod nasumično.
 */
export function rewriteJs(
  fromFile: string,
  text: string,
  files: SiteFiles,
): ReferenceRewrite {
  const references = new Set<string>();

  const result = text.replace(JS_STRING, (match, quote: string, value: string) => {
    if (!/[./]/.test(value)) return match;
    const target = takeReference(fromFile, value, files, references);
    return target ? `${quote}${assetToken(target)}${quote}` : match;
  });

  return { text: result, references };
}

/** Bira pravu obradu prema ekstenziji fajla. */
export function rewriteTextAsset(
  fromFile: string,
  text: string,
  files: SiteFiles,
): ReferenceRewrite {
  if (fromFile.endsWith('.css')) return rewriteCss(fromFile, text, files);
  if (isTextAsset(fromFile)) return rewriteJs(fromFile, text, files);
  return { text, references: new Set() };
}

function takeReference(
  fromFile: string,
  reference: string,
  files: SiteFiles,
  collected: Set<string>,
): string | null {
  const target = resolveReference(fromFile, reference);
  if (!target || !files.has(target)) return null;

  collected.add(target);
  return target;
}
