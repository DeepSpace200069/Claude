/**
 * Provera da uvezen šablon ne vuče ništa sa tuđih domena (zahtev 24 i 29).
 *
 * Ovo je poslednja kapija uvoznika. Sve pre nje - preuzimanje CDN skripti,
 * fontova, zamena mapa - može da promaši neki zaboravljen URL; ova funkcija
 * traži šta je ostalo i uvoz staje ako nađe išta.
 *
 * Zašto je to uslov, a ne preporuka:
 *
 * - **CSP.** Politika dozvoljava skripte i stilove samo sa našeg domena. Šablon
 *   sa `<script src="https://cdn...">` ne bi radio u produkciji, a radio bi u
 *   razvoju - najgora vrsta greške.
 * - **Privatnost.** Svaki zahtev ka tuđem serveru odaje IP adresu gosta pre nego
 *   što je iko išta pitao. Mapa u `<iframe>` je najčešći primer.
 * - **Trajnost.** Pozivnica živi mesecima. CDN koji nestane ili promeni verziju
 *   pokvari tuđu proslavu, a mi za to saznamo od korisnika.
 *
 * Linkovi koje gost **klikće** (`<a href>`) su izuzetak: oni ne šalju nijedan
 * zahtev dok se ne klikne, a pozivnica bez linka ka mapama ili sajtu restorana
 * ne bi bila upotrebljiva.
 */

/** Šema koje ne vode ka mreži i zato ne smetaju. */
const SAFE_SCHEMES = /^(data:|blob:|mailto:|tel:|sms:|viber:|whatsapp:|geo:|#|\/)/i;

export type ExternalReference = {
  /** Fajl u kom je nađen. */
  file: string;
  url: string;
  /** Odakle potiče: atribut, `url()` u CSS-u ili golo pojavljivanje u JS-u. */
  origin: 'attribute' | 'css' | 'script' | 'import';
};

/** `src`, `href`, `srcset` i slično; `<a href>` se namerno preskače. */
const ATTRIBUTE_PATTERN =
  /<(?!a\b)([a-zA-Z][\w-]*)\b[^>]*?\b(src|href|srcset|data-src|poster|content)\s*=\s*["']([^"']+)["']/gi;

const CSS_URL_PATTERN = /url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi;
const CSS_IMPORT_PATTERN = /@import\s+(?:url\()?\s*["'](https?:\/\/[^"']+)["']/gi;
const JS_IMPORT_PATTERN = /\bfrom\s+["'](https?:\/\/[^"']+)["']|\bimport\s*\(\s*["'](https?:\/\/[^"']+)["']/gi;
const BARE_URL_PATTERN = /["'`](https?:\/\/[^"'`\s]+)["'`]/gi;

function isExternal(url: string): boolean {
  if (SAFE_SCHEMES.test(url)) return false;
  return /^https?:\/\//i.test(url);
}

/**
 * Traži spoljne reference u jednom fajlu.
 *
 * Namerno je regex, a ne parser: cilj nije savršena analiza nego da se ne
 * propusti očigledno. Lažno pozitivan nalaz (URL u komentaru) košta jedan
 * komentar u `template.json`; propušten nalaz košta pokvarenu pozivnicu.
 */
export function findExternalReferences(
  file: string,
  content: string,
): ExternalReference[] {
  const found: ExternalReference[] = [];
  const seen = new Set<string>();

  const add = (url: string, origin: ExternalReference['origin']): void => {
    if (!isExternal(url) || seen.has(`${origin}:${url}`)) return;
    seen.add(`${origin}:${url}`);
    found.push({ file, url, origin });
  };

  // SVG ide uz HTML: ima iste atribute (`href`, `xlink:href`) i sme da nosi skriptu.
  const isMarkup = /\.(html?|svg)$/i.test(file);
  const isCss = /\.css$/i.test(file);
  const isJs = /\.m?js$/i.test(file);

  if (isMarkup) {
    for (const match of content.matchAll(ATTRIBUTE_PATTERN)) {
      add(match[3] ?? '', 'attribute');
    }

    /*
     * Golo traženje URL-a u navodnicima se nad HTML-om **ne** pušta: pogodilo
     * bi i `<a href>`, koji je namerno izuzet. Umesto toga se izdvoje ugrađene
     * skripte i one prođu kroz istu proveru kao zaseban JS fajl.
     */
    for (const block of content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      scanScript(block[1] ?? '', add);
    }
  }

  if (isMarkup || isCss) {
    for (const match of content.matchAll(CSS_URL_PATTERN)) add(match[1] ?? '', 'css');
    for (const match of content.matchAll(CSS_IMPORT_PATTERN)) add(match[1] ?? '', 'css');
  }

  if (isJs) scanScript(content, add);

  return found;
}

function scanScript(
  code: string,
  add: (url: string, origin: ExternalReference['origin']) => void,
): void {
  for (const match of code.matchAll(JS_IMPORT_PATTERN)) {
    add(match[1] ?? match[2] ?? '', 'import');
  }
  for (const match of code.matchAll(BARE_URL_PATTERN)) add(match[1] ?? '', 'script');
}

/** Da li je iframe ka tuđem sajtu ostao u dokumentu (najčešće mapa). */
export function findExternalFrames(html: string): string[] {
  const frames: string[] = [];

  for (const match of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const url = match[1] ?? '';
    if (isExternal(url)) frames.push(url);
  }

  return frames;
}

/** Poruka za CLI: šta je nađeno i gde, bez pogađanja šta korisnik treba da uradi. */
export function describeExternalReferences(
  references: ExternalReference[],
): string {
  return references
    .map((reference) => `  ${reference.file} (${reference.origin}): ${reference.url}`)
    .join('\n');
}
