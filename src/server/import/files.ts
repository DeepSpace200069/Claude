import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Čitanje foldera sa uvezenim sajtom (zahtev 39.3).
 *
 * Folder je tuđi rad: nastao je ručno, često sa ostacima - `.DS_Store`, stara
 * verzija skripte, `README`. Zato se ovde radi dvoje: fajlovi se čitaju u
 * memoriju pod POSIX putanjama (isto na Linuxu i na Windowsu), a tipovi se
 * određuju iz **spiska dozvoljenih** ekstenzija.
 *
 * Spisak je namerno allowlist. U storage odlazi samo ono što pozivnica zaista
 * može da prikaže; sve ostalo je greška uvoza, a ne fajl koji ćemo servirati sa
 * svog domena zato što se zatekao u folderu.
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

/** Fajlovi u kojima uvoznik prepisuje putanje i traži tokene. */
const TEXT_EXTENSIONS = new Set(['css', 'js', 'mjs']);

/** Šta se nikad ne čita iz foldera. */
const IGNORED = new Set(['template.json', '.DS_Store', 'Thumbs.db']);

export type SiteFiles = Map<string, Uint8Array>;

export function extensionOf(filePath: string): string {
  return path.posix.extname(filePath).replace(/^\./, '').toLowerCase();
}

export function contentTypeOf(filePath: string): string | null {
  return CONTENT_TYPES[extensionOf(filePath)] ?? null;
}

export function isTextAsset(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(filePath));
}

export function isHtml(filePath: string): boolean {
  const extension = extensionOf(filePath);
  return extension === 'html' || extension === 'htm';
}

/**
 * Rekurzivno čitanje foldera u mapu `putanja → bajtovi`.
 *
 * Skriveni folderi se preskaču (`.git`, `.vscode`): u njima nema ničega što
 * pozivnica prikazuje, a ima svega što ne bi trebalo da završi u storage-u.
 */
export async function readSiteFiles(root: string): Promise<SiteFiles> {
  const files: SiteFiles = new Map();

  async function walk(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;

      const absolute = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(absolute, relative);
        continue;
      }

      if (entry.isFile()) {
        files.set(relative, new Uint8Array(await readFile(absolute)));
      }
    }
  }

  await walk(root, '');
  return files;
}

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

export function decodeText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function encodeText(text: string): Uint8Array {
  return encoder.encode(text);
}

/**
 * Putanja na koju pokazuje referenca iz nekog fajla.
 *
 * Vraća `null` za sve što nije relativna putanja unutar šablona: apsolutne
 * URL-ove, `data:`, sidra i pokušaje izlaska iz foldera preko `..`. Pozivalac
 * time dobija jasnu podelu - ono što nije `null` je fajl šablona, a sve ostalo
 * ide na proveru spoljnih resursa.
 */
export function resolveReference(fromFile: string, reference: string): string | null {
  const trimmed = reference.trim();
  if (trimmed === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) return null;

  const withoutQuery = trimmed.split(/[?#]/)[0] ?? '';
  if (withoutQuery === '') return null;

  const base = path.posix.dirname(fromFile);
  const joined = withoutQuery.startsWith('/')
    ? withoutQuery.slice(1)
    : path.posix.join(base === '.' ? '' : base, withoutQuery);

  const normalized = path.posix.normalize(joined);
  if (normalized.startsWith('..') || normalized.startsWith('/')) return null;

  return normalized;
}
