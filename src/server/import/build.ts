import { JSDOM } from 'jsdom';

import type { FieldDefinitions } from '@/features/templates/html-schema';
import {
  describeExternalReferences,
  findExternalFrames,
  findExternalReferences,
} from '@/lib/html-template/audit';
import { RSVP_SLOT, splitHtmlDocument } from '@/lib/html-template/document';
import {
  assetToken,
  fieldToken,
  resolveAssetTokens,
  tokensUsedIn,
} from '@/lib/html-template/tokens';

import {
  contentTypeOf,
  decodeText,
  encodeText,
  isTextAsset,
  resolveReference,
  type SiteFiles,
} from './files';
import { ImportError } from './errors';
import type { ImportManifest, MapCard } from './manifest';
import {
  replaceVendorUrls,
  rewriteCss,
  rewriteJs,
  rewriteTextAsset,
  type ReferenceRewrite,
} from './rewrite';

/**
 * Pretvaranje uvezenog foldera u jedan šablon (zahtev 39.3).
 *
 * Ovo je srce uvoznika i jedino mesto na kom se koristi parser HTML-a. Sve
 * posle ovoga - čuvanje u bazi, uređivač, javni prikaz - radi sa gotovim
 * tekstom i tokenima, pa `jsdom` nikad ne ulazi u aplikaciju.
 *
 * Šta se ovde dešava sa tuđim sajtom:
 *
 * 1. izbacuje se ono što je operator naveo (`strip`) i ono što platforma sama
 *    postavlja (`<title>`, Open Graph oznake),
 * 2. ugrađene mape se zamenjuju karticom sa linkom - `<iframe>` ka Google-u pada
 *    na CSP-u i odaje IP adresu gosta pre ikakvog pristanka,
 * 3. ukrasna RSVP forma se zamenjuje mestom za pravu formu platforme,
 * 4. mesta na kojima stoji sadržaj postaju tokeni polja,
 * 5. svaka putanja ka fajlu šablona postaje `{{asset:...}}`,
 * 6. na kraju se proverava da u dokumentu i fajlovima nije ostala **nijedna**
 *    adresa ka tuđem domenu.
 *
 * Ako bilo koji korak ne uspe, uvoz staje. Šablon koji se „skoro” uvezao je
 * gori od neuvezenog: greška bi se videla tek na tuđoj proslavi.
 */

/** Atributi koji nose adresu; `<a href>` se obrađuje posebno (namerno se ne dira). */
const URL_ATTRIBUTES = ['src', 'href', 'poster', 'data-src', 'xlink:href'];

/** Oznake iz `<head>` koje platforma postavlja sama, pa se iz šablona uklanjaju. */
const PLATFORM_HEAD_SELECTOR = [
  'title',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
].join(', ');

/** Minimalan stil kartice lokacije; ubacuje se samo ako je bar jedna mapa zamenjena. */
const MAP_CARD_STYLE = `
.pozivnica-mapa{display:inline-flex;flex-direction:column;gap:.25rem;padding:1rem 1.25rem;
border:1px solid currentColor;border-radius:.75rem;text-decoration:none;color:inherit;max-width:32rem}
.pozivnica-mapa__naziv{font-weight:600}
.pozivnica-mapa__akcija{text-decoration:underline;font-size:.875rem}
`.trim();

export type BuiltAsset = {
  /** Putanja unutar šablona (`img/hero.webp`). */
  path: string;
  contentType: string;
  content: Uint8Array;
};

export type BuiltTemplate = {
  /** Ceo dokument sa tokenima; ide u `template_versions.html_document`. */
  document: string;
  assets: BuiltAsset[];
  fieldDefinitions: FieldDefinitions;
  /** CSS i JS koji su ušli u dokument jer nose vrednosti polja. */
  inlined: string[];
  warnings: string[];
};

export function buildTemplate(options: {
  manifest: ImportManifest;
  files: SiteFiles;
  /** Putanja asseta → URL sa kog se servira; zavisi od id-a verzije. */
  assetUrl: (path: string) => string;
}): BuiltTemplate {
  const { manifest, files, assetUrl } = options;
  const warnings: string[] = [];

  const entryBytes = files.get(manifest.entry);
  if (!entryBytes) {
    throw new ImportError(`Ulazni fajl „${manifest.entry}” ne postoji u folderu.`);
  }

  const entryHtml = decodeText(entryBytes);
  if (/\{\{(text|attr|js|asset):/.test(entryHtml)) {
    throw new ImportError(
      'Sajt već sadrži tokene oblika {{text:...}}. Uvoznik ih sam upisuje, pa bi se ' +
        'postojeći pomešali sa novima.',
    );
  }

  // 1. Tekstualni fajlovi se obrade unapred - odluka o ugrađivanju traži njihov sadržaj.
  const transformed = new Map<string, ReferenceRewrite>();
  for (const [filePath, bytes] of files) {
    if (filePath === manifest.entry || !isTextAsset(filePath)) continue;

    const withVendor = replaceVendorUrls(decodeText(bytes), manifest.vendor);
    const withFields = applyScriptBindings(manifest, filePath, withVendor);
    transformed.set(filePath, rewriteTextAsset(filePath, withFields, files));
  }

  // 2. Obrada dokumenta.
  const dom = new JSDOM(entryHtml);
  const doc = dom.window.document;
  const used = new Set<string>();
  const inlined: string[] = [];

  const context: BuildContext = {
    manifest,
    files,
    transformed,
    used,
    inlined,
    warnings,
    doc,
  };

  stripElements(context);
  replaceMaps(context);
  placeRsvpSlot(context);
  bindFields(context);
  rewriteLinkedAssets(context);
  rewriteInlineCode(context);
  rewriteUrlAttributes(context);
  keepImageDefaults(context);

  const document = dom.serialize();

  // 3. Fajlovi koji ostaju fajlovi: prikupljanje i razrešavanje tokena.
  const assets = collectAssets({ ...context, assetUrl });

  // 4. Provere bez kojih uvoz ne sme da prođe.
  assertNoExternalReferences(document, assets);
  assertRenderable(document, manifest);

  return {
    document,
    assets,
    fieldDefinitions: manifest.form,
    inlined,
    warnings,
  };
}

type BuildContext = {
  manifest: ImportManifest;
  files: SiteFiles;
  transformed: Map<string, ReferenceRewrite>;
  used: Set<string>;
  inlined: string[];
  warnings: string[];
  doc: Document;
};

// --- koraci obrade dokumenta ------------------------------------------------

function select(context: BuildContext, selector: string): Element[] {
  try {
    return [...context.doc.querySelectorAll(selector)];
  } catch {
    throw new ImportError(`Selektor „${selector}” nije ispravan CSS selektor.`);
  }
}

function stripElements(context: BuildContext): void {
  for (const selector of context.manifest.strip) {
    const found = select(context, selector);
    if (found.length === 0) {
      context.warnings.push(`„strip”: selektor „${selector}” ništa ne pogađa.`);
    }
    for (const element of found) element.remove();
  }

  for (const element of select(context, PLATFORM_HEAD_SELECTOR)) {
    element.remove();
  }
}

/**
 * Ugrađena mapa → kartica sa linkom.
 *
 * Kartica se pravi **prazna**, a naziv, adresu i link u nju upisuje redovno
 * vezivanje polja (`bindFields`, koje se pokreće posle ovoga). Time kartica
 * nema poseban put kroz uvoznik: u `template.json` se vidi tačno koje polje ide
 * gde, isto kao za bilo koji drugi deo šablona.
 *
 * Link se otvara u novom tabu sa `rel="noopener noreferrer"`: bez toga bi
 * otvorena strana preko `window.opener` imala pristup pozivnici.
 */
function replaceMaps(context: BuildContext): void {
  if (context.manifest.maps.length === 0) return;

  for (const map of context.manifest.maps) {
    const targets = select(context, map.selector);
    if (targets.length === 0) {
      throw new ImportError(
        `Mapa: selektor „${map.selector}” ništa ne pogađa. Ako mape više nema, ` +
          'izbaci je iz „maps” u template.json.',
      );
    }

    for (const target of targets) {
      target.replaceWith(buildMapCard(context.doc, map));
    }
  }

  const style = context.doc.createElement('style');
  style.setAttribute('data-pozivnica', 'mapa');
  style.textContent = MAP_CARD_STYLE;
  context.doc.head.append(style);
}

function buildMapCard(doc: Document, map: MapCard): Element {
  const card = doc.createElement('a');
  card.className = 'pozivnica-mapa';
  card.setAttribute('data-mapa', map.nameField);
  card.setAttribute('href', '#');
  card.setAttribute('target', '_blank');
  card.setAttribute('rel', 'noopener noreferrer');

  for (const className of ['pozivnica-mapa__naziv', 'pozivnica-mapa__adresa']) {
    const span = doc.createElement('span');
    span.className = className;
    card.append(span);
  }

  const action = doc.createElement('span');
  action.className = 'pozivnica-mapa__akcija';
  action.textContent = map.label;
  card.append(action);

  return card;
}

/** Selektori kartice lokacije; isti oblik piše i prvi prolaz uvoza u `template.json`. */
export function mapCardSelectors(nameField: string): {
  card: string;
  name: string;
  address: string;
} {
  const card = `[data-mapa="${nameField}"]`;
  return {
    card,
    name: `${card} .pozivnica-mapa__naziv`,
    address: `${card} .pozivnica-mapa__adresa`,
  };
}

function placeRsvpSlot(context: BuildContext): void {
  const slot = context.doc.createElement('div');
  slot.setAttribute('data-slot', 'rsvp');

  if (!context.manifest.rsvp) {
    context.doc.body.append(slot);
    context.warnings.push(
      'U šablonu nije naznačena RSVP forma, pa je mesto dodato na kraj stranice.',
    );
    return;
  }

  const targets = select(context, context.manifest.rsvp.selector);
  if (targets.length !== 1) {
    throw new ImportError(
      `RSVP: selektor „${context.manifest.rsvp.selector}” pogađa ${targets.length} ` +
        'elemenata, a mora tačno jedan.',
    );
  }

  targets[0]?.replaceWith(slot);
}

function bindFields(context: BuildContext): void {
  for (const field of context.manifest.form.fields) {
    for (const binding of field.bind) {
      if (binding.kind === 'script') continue; // radi se nad tekstom, ne nad DOM-om

      const targets = select(context, binding.selector);
      if (targets.length === 0) {
        throw new ImportError(
          `Polje „${field.key}”: selektor „${binding.selector}” ništa ne pogađa.`,
        );
      }

      for (const target of targets) {
        if (binding.kind === 'text') {
          target.textContent = fieldToken('text', field.key);
        } else {
          target.setAttribute(binding.attr, fieldToken('attr', field.key));
        }
      }
    }
  }
}

/**
 * `<link rel="stylesheet">` i `<script src>`: fajl ili ugrađivanje.
 *
 * Fajl koji nosi vrednost polja **mora** da uđe u dokument - fajlovi se
 * serviraju kakvi jesu, isti za sve pozivnice, pa u njima nema kome da se
 * zameni vrednost. Sve ostalo (biblioteke, stilovi) ostaje zaseban fajl, koji
 * pregledač onda i kešira.
 */
function rewriteLinkedAssets(context: BuildContext): void {
  for (const link of select(context, 'link[rel~="stylesheet"][href]')) {
    const target = resolveAssetPath(context, context.manifest.entry, link.getAttribute('href'));
    const rewritten = target ? context.transformed.get(target) : undefined;
    if (!target || !rewritten) continue;

    if (hasFieldTokens(rewritten.text)) {
      const style = context.doc.createElement('style');
      style.setAttribute('data-pozivnica-fajl', target);
      style.textContent = rewritten.text;
      link.replaceWith(style);
      context.inlined.push(target);
      addReferences(context, rewritten);
      continue;
    }

    link.setAttribute('href', assetToken(target));
    markUsed(context, target);
  }

  for (const script of select(context, 'script[src]')) {
    const target = resolveAssetPath(context, context.manifest.entry, script.getAttribute('src'));
    const rewritten = target ? context.transformed.get(target) : undefined;
    if (!target || !rewritten) continue;

    if (hasFieldTokens(rewritten.text)) {
      const inline = context.doc.createElement('script');
      for (const name of script.getAttributeNames()) {
        if (name === 'src') continue;
        inline.setAttribute(name, script.getAttribute(name) ?? '');
      }
      inline.textContent = rewritten.text;
      script.replaceWith(inline);
      context.inlined.push(target);
      addReferences(context, rewritten);
      continue;
    }

    script.setAttribute('src', assetToken(target));
    markUsed(context, target);
  }
}

/** Ugrađeni `<style>`, `<script>` i `style` atributi prolaze kroz istu obradu kao fajlovi. */
function rewriteInlineCode(context: BuildContext): void {
  const entry = context.manifest.entry;

  for (const style of select(context, 'style')) {
    if (style.getAttribute('data-pozivnica-fajl') !== null) continue;
    if (style.getAttribute('data-pozivnica') === 'mapa') continue;

    const source = replaceVendorUrls(style.textContent ?? '', context.manifest.vendor);
    const rewritten = rewriteCss(entry, source, context.files);
    style.textContent = rewritten.text;
    addReferences(context, rewritten);
  }

  for (const script of select(context, 'script:not([src])')) {
    if (script.getAttribute('data-pozivnica-fajl') !== null) continue;

    const type = script.getAttribute('type');
    if (type && !/javascript|module/i.test(type)) continue;

    const withVendor = replaceVendorUrls(script.textContent ?? '', context.manifest.vendor);
    const withFields = applyScriptBindings(context.manifest, entry, withVendor);
    const rewritten = rewriteJs(entry, withFields, context.files);
    script.textContent = rewritten.text;
    addReferences(context, rewritten);
  }

  for (const element of select(context, '[style]')) {
    const source = replaceVendorUrls(
      element.getAttribute('style') ?? '',
      context.manifest.vendor,
    );
    const rewritten = rewriteCss(entry, source, context.files);
    element.setAttribute('style', rewritten.text);
    addReferences(context, rewritten);
  }
}

/** Slike, video, fontovi i ostalo što pokazuje na fajl šablona. */
function rewriteUrlAttributes(context: BuildContext): void {
  for (const element of select(context, '*')) {
    const tag = element.tagName.toLowerCase();

    for (const name of element.getAttributeNames()) {
      const value = element.getAttribute(name) ?? '';

      if (name === 'srcset') {
        element.setAttribute(name, rewriteSrcset(context, value));
        continue;
      }

      if (!URL_ATTRIBUTES.includes(name)) continue;
      // Link koji gost klikće ostaje netaknut - i kad vodi na drugu stranu sajta.
      if (name === 'href' && (tag === 'a' || tag === 'area')) continue;
      // `<link rel=stylesheet>` i `<script src>` su već obrađeni.
      if (value.startsWith('{{')) continue;

      const target = resolveAssetPath(context, context.manifest.entry, value);
      if (!target) continue;

      element.setAttribute(name, assetToken(target));
      markUsed(context, target);
    }
  }
}

function rewriteSrcset(context: BuildContext, value: string): string {
  return value
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const url = parts[0];
      if (!url || url.startsWith('{{')) return candidate.trim();

      const target = resolveAssetPath(context, context.manifest.entry, url);
      if (!target) return candidate.trim();

      markUsed(context, target);
      return [assetToken(target), ...parts.slice(1)].join(' ');
    })
    .join(', ');
}

/**
 * Slika kao podrazumevana vrednost polja.
 *
 * Polje tipa `image` počinje sa fotografijom iz originalnog sajta. Ta
 * fotografija se u dokumentu više ne pominje (na njenom mestu je token), pa bi
 * je prikupljanje fajlova inače izbacilo kao nekorišćenu.
 */
function keepImageDefaults(context: BuildContext): void {
  for (const field of context.manifest.form.fields) {
    if (field.type !== 'image' || field.default === '') continue;

    const target = resolveReference(context.manifest.entry, field.default);
    if (target && context.files.has(target)) markUsed(context, target);
  }
}

// --- prikupljanje fajlova ---------------------------------------------------

function collectAssets(
  context: BuildContext & { assetUrl: (path: string) => string },
): BuiltAsset[] {
  // Fajl koji je uključen preko drugog fajla (CSS koji uvozi font) mora i sam da uđe.
  const queue = [...context.used];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const reference of context.transformed.get(current)?.references ?? []) {
      if (!context.used.has(reference)) {
        context.used.add(reference);
        queue.push(reference);
      }
    }
  }

  const inlinedPaths = new Set(context.inlined);
  const assets: BuiltAsset[] = [];

  for (const path of [...context.used].sort()) {
    if (inlinedPaths.has(path)) continue;

    const contentType = contentTypeOf(path);
    if (!contentType) {
      throw new ImportError(
        `Fajl „${path}” ima ekstenziju koju ne serviramo. Izbaci ga iz šablona ili ` +
          'ga prevedi u podržan format.',
      );
    }

    const rewritten = context.transformed.get(path);
    if (!rewritten) {
      const bytes = context.files.get(path);
      if (!bytes) throw new ImportError(`Fajl „${path}” ne postoji u folderu.`);
      assets.push({ path, contentType, content: bytes });
      continue;
    }

    if (hasFieldTokens(rewritten.text)) {
      throw new ImportError(
        `Fajl „${path}” sadrži vrednost polja, a ne uključuje se iz dokumenta. ` +
          'Uključi ga preko <link> ili <script src>, da bi mogao da bude ugrađen.',
      );
    }

    /*
     * Fajlovi se serviraju takvi kakvi jesu, isti za sve pozivnice, pa se
     * `{{asset:...}}` u njima razrešava sada. Adresa zavisi samo od verzije
     * šablona, koja je u ovom trenutku već poznata.
     */
    const resolved = resolveAssetTokens(rewritten.text, context.assetUrl);

    assets.push({ path, contentType, content: encodeText(resolved) });
  }

  return assets;
}

// --- provere ----------------------------------------------------------------

function assertNoExternalReferences(document: string, assets: BuiltAsset[]): void {
  const found = [
    ...findExternalReferences('dokument.html', document),
    ...assets.flatMap((asset) =>
      isTextAsset(asset.path)
        ? findExternalReferences(asset.path, decodeText(asset.content))
        : [],
    ),
  ];

  if (found.length > 0) {
    throw new ImportError(
      'U šablonu su ostale adrese ka tuđim domenima:\n' +
        `${describeExternalReferences(found)}\n` +
        'Dodaj ih u „vendor” u template.json da bi bile preuzete, ili ih ukloni.',
    );
  }

  const frames = findExternalFrames(document);
  if (frames.length > 0) {
    throw new ImportError(
      `U dokumentu je ostao <iframe> ka tuđem sajtu: ${frames.join(', ')}. ` +
        'Dodaj ga u „maps” ili u „strip”.',
    );
  }
}

/** Dokument mora da se rastavi na delove i da ima tačno jedno mesto za RSVP. */
function assertRenderable(document: string, manifest: ImportManifest): void {
  const parts = splitHtmlDocument(document);
  if (!parts) {
    throw new ImportError(
      'Dokument ne može da se rastavi na <head> i <body>. Najčešći uzrok je ' +
        'string „</body>” ili „</head>” unutar ugrađene skripte.',
    );
  }

  const slots = parts.bodyHtml.split(RSVP_SLOT).length - 1;
  if (slots !== 1) {
    throw new ImportError(`Mesto za RSVP formu se pojavljuje ${slots} puta, a mora jednom.`);
  }

  const { fields } = tokensUsedIn(document);
  const declared = new Set(manifest.form.fields.map((field) => field.key));

  for (const key of fields) {
    if (!declared.has(key)) {
      throw new ImportError(`Dokument koristi polje „${key}” koje nije opisano u template.json.`);
    }
  }

  for (const key of declared) {
    if (!fields.includes(key)) {
      throw new ImportError(
        `Polje „${key}” nije završilo u dokumentu. Proveri „bind” - najverovatnije je ` +
          'vezano za skriptu koja se ne uključuje iz dokumenta.',
      );
    }
  }
}

// --- pomoćne funkcije -------------------------------------------------------

function hasFieldTokens(text: string): boolean {
  return /\{\{(text|attr|js):/.test(text);
}

function markUsed(context: BuildContext, path: string): void {
  context.used.add(path);
}

function addReferences(context: BuildContext, rewritten: ReferenceRewrite): void {
  for (const reference of rewritten.references) markUsed(context, reference);
}

/**
 * Adresa iz atributa → putanja fajla šablona.
 *
 * Prvo se gleda spisak preuzetih resursa (adresa CDN-a je posle uvoza običan
 * fajl), pa tek onda relativna putanja.
 */
function resolveAssetPath(
  context: BuildContext,
  fromFile: string,
  value: string | null,
): string | null {
  if (!value) return null;

  const vendored = context.manifest.vendor.find((resource) => resource.url === value.trim());
  if (vendored) {
    if (!context.files.has(vendored.path)) {
      throw new ImportError(`Preuzet fajl „${vendored.path}” nedostaje.`);
    }
    return vendored.path;
  }

  const target = resolveReference(fromFile, value);
  return target && context.files.has(target) ? target : null;
}

/**
 * Vezivanja tipa `script`: literal iz šablona → token polja.
 *
 * U HTML fajlu se traži samo unutar `<script>` blokova; u JS fajlu svuda.
 * Primenjuje se na tekst, jer je literal deo koda, a ne deo strukture.
 */
function applyScriptBindings(
  manifest: ImportManifest,
  filePath: string,
  text: string,
): string {
  let result = text;

  for (const field of manifest.form.fields) {
    for (const binding of field.bind) {
      if (binding.kind !== 'script' || binding.file !== filePath) continue;
      result = result.split(binding.token).join(fieldToken('js', field.key));
    }
  }

  return result;
}
