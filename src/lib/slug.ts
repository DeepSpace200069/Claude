/**
 * Generisanje ASCII slugova bez dijakritike.
 *
 * Podržava srpsku latinicu i ćirilicu, kao i uobičajene evropske dijakritike,
 * jer korisnici unose naslove tipa „Miloš i Đurđa” ili „Милош и Ђурђа”.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'dj',
  е: 'e',
  ж: 'z',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'c',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'c',
  џ: 'dz',
  ш: 's',
};

const LATIN_MAP: Record<string, string> = {
  č: 'c',
  ć: 'c',
  đ: 'dj',
  š: 's',
  ž: 'z',
  ä: 'a',
  ö: 'o',
  ü: 'u',
  ß: 'ss',
};

/** Najveća dozvoljena dužina sluga (ostavlja prostor za sufiks jedinstvenosti). */
export const MAX_SLUG_LENGTH = 60;

/**
 * Sistemski zauzeti slugovi.
 *
 * Javne pozivnice žive na `/p/[slug]`, ali rezervišemo i nazive ruta jer se
 * poddomeni i buduće rute mogu preklopiti sa korisničkim slugovima.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'assets',
  'blog',
  'cdn',
  'cenovnik',
  'cesta-pitanja',
  'demo',
  'dogadjaji',
  'dokumentacija',
  'edit',
  'editor',
  'faq',
  'gosti',
  'help',
  'kako-funkcionise',
  'kontakt',
  'login',
  'logout',
  'mail',
  'me',
  'new',
  'novo',
  'p',
  'podesavanja',
  'politika-privatnosti',
  'pomoc',
  'preview',
  'pregled',
  'privacy',
  'public',
  'registracija',
  'rsvp',
  'sabloni',
  'sedenje',
  'settings',
  'signin',
  'signout',
  'static',
  'status',
  'support',
  'system',
  'terms',
  'uslovi-koriscenja',
  'www',
]);

/** Pretvara proizvoljan tekst u ASCII slug bezbedan za URL. */
export function slugify(input: string): string {
  const lowered = input.normalize('NFC').toLowerCase();

  let mapped = '';
  for (const char of lowered) {
    mapped += CYRILLIC_MAP[char] ?? LATIN_MAP[char] ?? char;
  }

  return mapped
    .normalize('NFD')
    // Uklanja preostale kombinujuće znakove (é -> e).
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/** Da li je slug sistemski rezervisan. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Provera da li je slug ispravnog oblika (bez provere jedinstvenosti). */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= 3 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug)
  );
}

/**
 * Predlaže slug na osnovu naslova, uz fallback kada naslov ne daje ništa
 * upotrebljivo (npr. sadrži samo emodžije).
 */
export function buildSlugCandidate(
  title: string,
  fallback = 'pozivnica',
): string {
  const base = slugify(title);
  if (base.length >= 3 && !isReservedSlug(base)) return base;
  if (base.length >= 3 && isReservedSlug(base)) return `${base}-pozivnica`;
  return fallback;
}

/**
 * Vraća sledeći kandidat kada je slug zauzet.
 *
 * Prva dva pokušaja koriste kratak čitljiv brojčani sufiks, a posle toga
 * prelazimo na nasumični sufiks da ne bismo curili informaciju o broju
 * postojećih pozivnica sa sličnim nazivom.
 */
export function nextSlugCandidate(
  base: string,
  attempt: number,
  randomSuffix: () => string,
): string {
  const suffix = attempt <= 2 ? String(attempt + 1) : randomSuffix();
  const trimmed = base.slice(0, MAX_SLUG_LENGTH - suffix.length - 1);
  return `${trimmed.replace(/-+$/g, '')}-${suffix}`;
}
