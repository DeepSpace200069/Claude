import { JSDOM } from 'jsdom';

import type {
  FieldBinding,
  HtmlField,
  HtmlFieldType,
} from '@/features/templates/html-schema';
import { findExternalFrames, findExternalReferences } from '@/lib/html-template/audit';

import { mapCardSelectors } from './build';
import { decodeText, isHtml, resolveReference, type SiteFiles } from './files';
import { ImportError } from './errors';

/**
 * Prvi prolaz uvoza: predlog `template.json` (zahtev 39.3).
 *
 * Analiza **ne dira ni bazu ni fajlove šablona**. Ona pročita sajt i napiše šta
 * je videla: koje adrese vode van našeg domena, gde je ugrađena mapa, koja
 * forma liči na RSVP i šta bi mogla da budu polja koja organizator popunjava.
 *
 * Predlog je početna tačka, ne rezultat. Nijedna heuristika ne zna šta je u
 * tuđem sajtu „ime mlade”, a šta ukrasni natpis - to zna samo čovek koji gleda
 * stranicu. Zato analiza radije predloži previše nego premalo: brisanje suvišnog
 * polja traje sekund, a pronalaženje propuštenog traje koliko i čitanje celog
 * HTML-a.
 */

/** Koliko slika najviše ulazi u predlog; više od toga je šum, ne pomoć. */
const MAX_IMAGE_FIELDS = 6;

/** Dužina teksta preko koje polje postaje `longtext`. */
const LONGTEXT_THRESHOLD = 140;

export type AnalysisReport = {
  /** Predlog `template.json`, spreman za upis. */
  manifest: Record<string, unknown>;
  /** Šta operator mora da pogleda pre uvoza. */
  notes: string[];
};

export function analyzeSite(options: {
  files: SiteFiles;
  entry: string;
  /** Slug se izvodi iz imena foldera. */
  slug: string;
}): AnalysisReport {
  const { files, entry, slug } = options;

  const entryBytes = files.get(entry);
  if (!entryBytes) {
    throw new ImportError(`Ulazni fajl „${entry}” ne postoji u folderu.`);
  }

  const dom = new JSDOM(decodeText(entryBytes));
  const doc = dom.window.document;
  const notes: string[] = [];

  // Mape se obrađuju pre svega ostalog: njihove adrese ne idu u „vendor” nego
  // nestaju zajedno sa `<iframe>`-om.
  const maps = proposeMaps(doc, notes);
  const vendor = proposeVendor(files, maps.frameUrls, notes);
  const rsvp = proposeRsvp(doc, notes);

  const fields: HtmlField[] = [
    ...maps.fields,
    ...proposeTextFields(doc),
    ...proposeImageFields(doc, entry, files),
  ];

  if (fields.length === maps.fields.length) {
    notes.push(
      'Nije prepoznato nijedno polje. Dopiši ih ručno u „form.fields” - bez njih ' +
        'organizator ne bi imao šta da menja.',
    );
  }

  return {
    manifest: {
      note:
        'Predlog uvoznika. Proveri „eventType”, imena i grupe polja, pa pokreni uvoz. ' +
        'Ovo polje uvoz ne koristi.',
      slug,
      name: doc.title.trim() || slug,
      description: '',
      eventType: 'vencanje',
      style: 'elegant',
      dominantColor: '#111111',
      usesPhotos: true,
      requiredPlan: 'premium',
      isFeatured: false,
      sortOrder: 0,
      entry,
      vendor,
      rsvp,
      maps: maps.cards,
      strip: [],
      form: {
        groups: [
          { key: 'osnovno', label: { 'sr-Latn': 'Osnovno' } },
          { key: 'detalji', label: { 'sr-Latn': 'Detalji' } },
          { key: 'lokacije', label: { 'sr-Latn': 'Lokacije' } },
          { key: 'slike', label: { 'sr-Latn': 'Fotografije' } },
        ],
        fields,
      },
    },
    notes,
  };
}

// --- predlozi ---------------------------------------------------------------

function proposeVendor(
  files: SiteFiles,
  frameUrls: Set<string>,
  notes: string[],
): Array<{ url: string; path: string }> {
  const urls = new Set<string>();

  for (const [filePath, bytes] of files) {
    if (!isHtml(filePath) && !/\.(css|m?js)$/i.test(filePath)) continue;

    for (const reference of findExternalReferences(filePath, decodeText(bytes))) {
      if (!frameUrls.has(reference.url)) urls.add(reference.url);
    }
  }

  const taken = new Set(files.keys());
  const vendor = [...urls].sort().map((url) => ({ url, path: vendorPath(url, taken) }));

  if (vendor.length > 0) {
    notes.push(
      `Nađeno je ${vendor.length} adresa van našeg domena. Uvoz će ih preuzeti u folder ` +
        'i servirati sa našeg domena; proveri predložene putanje.',
    );
  }

  return vendor;
}

function vendorPath(url: string, taken: Set<string>): string {
  let name = 'resurs.js';

  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    if (base.includes('.')) name = base.replace(/[^\w.-]/g, '-');
    else if (parsed.hostname.includes('fonts.googleapis.com')) name = 'fontovi.css';
  } catch {
    // Neispravan URL ostaje sa podrazumevanim imenom; uvoz će ga odbiti sa porukom.
  }

  let candidate = `vendor/${name}`;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `vendor/${counter}-${name}`;
    counter += 1;
  }
  taken.add(candidate);

  return candidate;
}

function proposeMaps(
  doc: Document,
  notes: string[],
): {
  cards: Array<Record<string, string>>;
  fields: HtmlField[];
  frameUrls: Set<string>;
} {
  const frames = [...doc.querySelectorAll('iframe[src]')].filter((frame) =>
    findExternalFrames(frame.outerHTML).length > 0,
  );

  const cards: Array<Record<string, string>> = [];
  const fields: HtmlField[] = [];
  const frameUrls = new Set(
    frames.map((frame) => frame.getAttribute('src') ?? '').filter(Boolean),
  );

  frames.forEach((frame, index) => {
    const suffix = frames.length > 1 ? String(index + 1) : '';
    const selector = uniqueSelector(doc, frame);
    if (!selector) {
      notes.push('Ugrađena mapa nema stabilan selektor; dopiši ga ručno u „maps”.');
      return;
    }

    const keys = {
      name: `mestoNaziv${suffix}`,
      address: `mestoAdresa${suffix}`,
      url: `mestoLink${suffix}`,
    };

    cards.push({
      selector,
      nameField: keys.name,
      addressField: keys.address,
      urlField: keys.url,
      label: 'Otvori u mapama',
    });

    // Kartica nastaje tek pri uvozu, ali su joj selektori unapred poznati.
    const card = mapCardSelectors(keys.name);

    fields.push(
      textField(keys.name, 'lokacije', 'Naziv lokacije', nearbyText(frame), 'text', {
        kind: 'text',
        selector: card.name,
      }),
      textField(keys.address, 'lokacije', 'Adresa', '', 'text', {
        kind: 'text',
        selector: card.address,
      }),
      {
        key: keys.url,
        type: 'url',
        group: 'lokacije',
        label: { 'sr-Latn': 'Link ka mapama' },
        required: false,
        default: '',
        bind: [{ kind: 'attr', selector: card.card, attr: 'href' }],
      },
    );
  });

  if (cards.length > 0) {
    notes.push(
      `Nađeno je ${cards.length} ugrađenih mapa. Biće zamenjene karticom sa linkom - ` +
        '`<iframe>` ka Google-u pada na CSP-u i odaje IP adresu gosta pre pristanka.',
    );
  }

  return { cards, fields, frameUrls };
}

function proposeRsvp(doc: Document, notes: string[]): { selector: string } | null {
  const forms = [...doc.querySelectorAll('form')];
  const candidate = forms.find((form) => form.querySelectorAll('input, textarea, select').length > 0);

  if (!candidate) {
    notes.push('Nije nađena ukrasna RSVP forma; mesto za pravu formu ide na kraj stranice.');
    return null;
  }

  const selector = uniqueSelector(doc, candidate);
  if (!selector) {
    notes.push('Nađena je forma bez stabilnog selektora; dopiši „rsvp.selector” ručno.');
    return null;
  }

  notes.push(
    `Forma „${selector}” će biti zamenjena pravom RSVP formom platforme - ` +
      'ukrasna forma nigde ne šalje odgovore.',
  );

  return { selector };
}

function proposeTextFields(doc: Document): HtmlField[] {
  const fields: HtmlField[] = [];
  const used = new Set<string>();

  const candidates = [
    ...doc.querySelectorAll('[data-field]'),
    ...doc.querySelectorAll('h1, h2, h3, time'),
  ];

  for (const element of candidates) {
    if (element.closest('form')) continue;

    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ');
    if (text === '') continue;

    const selector = uniqueSelector(doc, element);
    if (!selector) continue;

    /*
     * `<time datetime="2026-09-12">12. septembar 2026.</time>` nosi dva
     * podatka: mašinski datum i ono što gost čita. Zato dobija i dva polja -
     * jedno bi značilo da organizator bira između ispravnog formata i lepog
     * ispisa.
     */
    const machineDate = element.tagName.toLowerCase() === 'time'
      ? (element.getAttribute('datetime') ?? '')
      : '';

    if (/^\d{4}-\d{2}-\d{2}/.test(machineDate)) {
      const key = uniqueKey(nameFor(element, 'datum'), used);
      fields.push({
        key,
        type: 'date',
        group: 'osnovno',
        label: { 'sr-Latn': 'Datum' },
        required: false,
        default: machineDate.slice(0, 10),
        bind: [{ kind: 'attr', selector, attr: 'datetime' }],
      });
    }

    const key = uniqueKey(nameFor(element, text), used);
    const type: HtmlFieldType = text.length > LONGTEXT_THRESHOLD ? 'longtext' : 'text';

    fields.push(
      textField(key, 'osnovno', truncate(text, 60), text, type, {
        kind: 'text',
        selector,
      }),
    );
  }

  return fields;
}

/**
 * Osnova za ključ polja.
 *
 * `data-field` je autorova namera i ima prednost; `id` je sledeći najbolji, jer
 * je kratak i govori šta je element. Tekst je poslednji izbor - iz njega
 * nastaju ključevi poput `anaIMarko`, tačni ali ružni.
 */
function nameFor(element: Element, fallback: string): string {
  return element.getAttribute('data-field') ?? element.getAttribute('id') ?? fallback;
}

function proposeImageFields(doc: Document, entry: string, files: SiteFiles): HtmlField[] {
  const fields: HtmlField[] = [];
  const used = new Set<string>();

  for (const image of doc.querySelectorAll('img[src]')) {
    if (fields.length >= MAX_IMAGE_FIELDS) break;

    const source = image.getAttribute('src') ?? '';
    const target = resolveReference(entry, source);
    if (!target || !files.has(target)) continue;

    const selector = uniqueSelector(doc, image);
    if (!selector) continue;

    const key = uniqueKey(`slika ${fields.length + 1}`, used);
    fields.push({
      key,
      type: 'image',
      group: 'slike',
      label: { 'sr-Latn': truncate(image.getAttribute('alt') || target, 60) },
      required: false,
      default: target,
      bind: [{ kind: 'attr', selector, attr: 'src' }],
    });
  }

  return fields;
}

// --- pomoćne funkcije -------------------------------------------------------

function textField(
  key: string,
  group: string,
  label: string,
  value: string,
  type: HtmlFieldType,
  bind?: FieldBinding,
): HtmlField {
  return {
    key,
    type,
    group,
    label: { 'sr-Latn': label || key },
    required: false,
    default: value,
    bind: [bind ?? { kind: 'text', selector: '' }],
  };
}

/**
 * Selektor koji pogađa tačno taj element.
 *
 * Prvo `id`, jer je čitljiv i preživi izmenu strukture; ako ga nema, gradi se
 * putanja sa `nth-of-type`. Rezultat se **proveri** nad dokumentom - selektor
 * koji pogađa dva elementa je gori od nikakvog, jer bi uvoz tiho promenio dva
 * mesta umesto jednog.
 */
function uniqueSelector(doc: Document, element: Element): string | null {
  const byId = safeId(element);
  if (byId && doc.querySelectorAll(byId).length === 1) return byId;

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== 'html') {
    const id = safeId(current);
    if (id) {
      parts.unshift(id);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (!parent) break;

    const node = current;
    const index =
      [...parent.children].filter((child) => child.tagName === node.tagName).indexOf(node) + 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
    current = parent;
  }

  const selector = parts.join(' > ');
  if (selector === '') return null;

  return doc.querySelectorAll(selector).length === 1 ? selector : null;
}

function safeId(element: Element): string | null {
  const id = element.getAttribute('id');
  return id && /^[a-zA-Z][\w-]*$/.test(id) ? `#${id}` : null;
}

/** Latinična transliteracija i camelCase; ključ mora da prođe `fieldKeySchema`. */
function uniqueKey(source: string, used: Set<string>): string {
  const base =
    source
      .toLowerCase()
      .replace(/[čć]/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z')
      .replace(/đ/g, 'dj')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 4)
      .map((word, index) => (index === 0 ? word : word[0]?.toUpperCase() + word.slice(1)))
      .join('')
      .slice(0, 40) || 'polje';

  const key = /^[a-zA-Z]/.test(base) ? base : `polje${base}`;

  let candidate = key;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${key}${counter}`;
    counter += 1;
  }
  used.add(candidate);

  return candidate;
}

function nearbyText(element: Element): string {
  const container = element.closest('section, div, article') ?? element;
  const heading = container.querySelector('h1, h2, h3, h4');
  return truncate((heading?.textContent ?? '').trim().replace(/\s+/g, ' '), 80);
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
