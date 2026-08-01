/**
 * Rastavljanje uvezenog dokumenta na delove (zahtev 39.4).
 *
 * Uvezen sajt je **ceo** HTML dokument: `<!doctype>`, `<html>`, `<head>` sa
 * stilovima i `<body>` sa skriptama. React ne ume da renderuje takav string kao
 * deo stabla - `<html>` i `<body>` proizvodi sam. Zato se dokument pri prikazu
 * rastavlja na atribute korenskih elemenata i na sadržaj glave i tela, pa se
 * svaki deo ubacuje tamo gde pripada.
 *
 * Rastavljanje je namerno bez parsera: dokument koji ovde stiže **nije** tuđi
 * proizvoljan HTML nego onaj koji je uvoznik sam serijalizovao kroz jsdom, a
 * uvoznik proveri da li rastavljanje uspeva i odbije uvoz ako ne uspe
 * (`assertSplittable`). Time se cena parsiranja plaća jednom, pri uvozu, a ne
 * pri svakom prikazu pozivnice.
 */

export type HtmlDocumentParts = {
  /** Atributi `<html>` elementa - pre svega `lang`. */
  htmlAttributes: Record<string, string>;
  /** Sadržaj `<head>`, bez samog elementa. */
  headHtml: string;
  bodyAttributes: Record<string, string>;
  /** Sadržaj `<body>`, bez samog elementa. */
  bodyHtml: string;
};

const HTML_OPEN = /<html\b([^>]*)>/i;
const HEAD_OPEN = /<head\b([^>]*)>/i;
const BODY_OPEN = /<body\b([^>]*)>/i;

const ATTRIBUTE = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function countOccurrences(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

/** Atributi otvorene oznake, onako kako ih je jsdom serijalizovao. */
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1];
    if (!name) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }

  return attributes;
}

/**
 * Rastavlja dokument; `null` znači da oblik nije prepoznat.
 *
 * `null` se vraća umesto izuzetka jer obe strane koje ovo zovu imaju šta da
 * urade sa njim: uvoznik prekida uvoz sa objašnjenjem, a prikaz pada na
 * bezbedno stanje umesto da sruši stranicu gostu.
 */
export function splitHtmlDocument(document: string): HtmlDocumentParts | null {
  /*
   * Zatvarajuće oznake se broje, a ne samo traže: `</body>` unutar stringa u
   * ugrađenoj skripti je validan HTML, ali bi ovde presekao dokument na
   * pogrešnom mestu. Ako ih ima više od jedne, oblik nije prepoznat.
   */
  if (
    countOccurrences(document, /<\/head\s*>/gi) !== 1 ||
    countOccurrences(document, /<\/body\s*>/gi) !== 1
  ) {
    return null;
  }

  const htmlOpen = HTML_OPEN.exec(document);
  const headOpen = HEAD_OPEN.exec(document);
  const bodyOpen = BODY_OPEN.exec(document);
  if (!htmlOpen || !headOpen || !bodyOpen) return null;

  const headEnd = document.search(/<\/head\s*>/i);
  const bodyEnd = document.search(/<\/body\s*>/i);

  const headStart = headOpen.index + headOpen[0].length;
  const bodyStart = bodyOpen.index + bodyOpen[0].length;

  if (headEnd < headStart || bodyEnd < bodyStart || bodyStart < headEnd) {
    return null;
  }

  return {
    htmlAttributes: parseAttributes(htmlOpen[1] ?? ''),
    headHtml: document.slice(headStart, headEnd),
    bodyAttributes: parseAttributes(bodyOpen[1] ?? ''),
    bodyHtml: document.slice(bodyStart, bodyEnd),
  };
}

/**
 * Mesto na kom javna pozivnica ubacuje pravu RSVP formu.
 *
 * Uvoznik ukrasnu formu iz šablona zamenjuje ovim praznim elementom; prikaz ga
 * traži u telu dokumenta i na tom mestu prekida ubacivanje HTML-a da bi
 * renderovao našu komponentu (zahtev 39.4).
 */
export const RSVP_SLOT = '<div data-slot="rsvp"></div>';

/**
 * Telo dokumenta podeljeno na deo pre i deo posle RSVP mesta.
 *
 * Ako mesta nema, ceo HTML je „pre”, a forma se prikazuje ispod njega - tako
 * pozivnica nikad ne ostane bez potvrde dolaska.
 */
export function splitAtRsvpSlot(bodyHtml: string): {
  before: string;
  after: string | null;
} {
  const index = bodyHtml.indexOf(RSVP_SLOT);
  if (index === -1) return { before: bodyHtml, after: null };

  return {
    before: bodyHtml.slice(0, index),
    after: bodyHtml.slice(index + RSVP_SLOT.length),
  };
}
