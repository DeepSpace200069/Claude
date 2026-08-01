import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CONTENT_TYPES,
  decodeText,
  extensionOf,
  type SiteFiles,
} from './files';
import { ImportError } from './errors';
import type { VendoredResource } from './manifest';

/**
 * Preuzimanje spoljnih resursa u šablon (zahtev 39.3).
 *
 * Sajtovi koji se uvoze skoro uvek vuku biblioteke sa CDN-a i fontove sa
 * Google-a. Posle uvoza toga ne sme da bude: politika sadržaja dozvoljava
 * skripte i stilove samo sa našeg domena, a i da ne dozvoljava, svaki zahtev ka
 * tuđem serveru odaje IP adresu gosta pre nego što je iko išta pitao.
 *
 * Zato uvoznik te fajlove **preuzme jednom, pri uvozu**, i sačuva ih i na disk,
 * u sam folder uvoza. Sledeće pokretanje ih zatekne i ne ide na mrežu - uvoz
 * radi i bez interneta, a operator može da pogleda šta je tačno preuzeto.
 */

/** Gornja granica po fajlu; iznad ovoga je skoro sigurno greška u `template.json`. */
const MAX_RESOURCE_BYTES = 8 * 1024 * 1024;

/** Adrese unutar preuzetog CSS-a - Google fonts CSS pokazuje na `fonts.gstatic.com`. */
const NESTED_URL =
  /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)|@import\s+(?:url\(\s*)?["'](https?:\/\/[^"']+)["']/gi;

/** Koliko puta se ulazi u preuzeti CSS da bi se pokupilo ono na šta on pokazuje. */
const MAX_DEPTH = 3;

export type VendorResult = {
  /** Fajlovi šablona, dopunjeni preuzetim resursima. */
  files: SiteFiles;
  /** Sve adrese koje su zamenjene lokalnim putanjama, uključujući i otkrivene. */
  vendor: VendoredResource[];
  /** Šta je stvarno otišlo na mrežu u ovom pokretanju. */
  downloaded: string[];
};

export async function vendorResources(options: {
  /** Folder uvoza, u koji se preuzeto snima kao keš; `null` isključuje snimanje. */
  cacheRoot: string | null;
  files: SiteFiles;
  vendor: VendoredResource[];
  /** Ubacuje se u testovima; u CLI-ju je globalni `fetch`. */
  fetchImpl?: typeof fetch;
}): Promise<VendorResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const files: SiteFiles = new Map(options.files);
  const vendor: VendoredResource[] = [...options.vendor];
  const downloaded: string[] = [];
  const byUrl = new Map(vendor.map((resource) => [resource.url, resource.path]));

  for (const resource of vendor) {
    if (!CONTENT_TYPES[extensionOf(resource.path)]) {
      throw new ImportError(
        `„vendor”: putanja „${resource.path}” nema ekstenziju koju umemo da serviramo. ` +
          'Dopiši je (npr. `vendor/fontovi.css`).',
      );
    }
  }

  let queue = [...vendor];

  for (let depth = 0; depth < MAX_DEPTH && queue.length > 0; depth += 1) {
    const next: VendoredResource[] = [];

    for (const resource of queue) {
      const existing = files.get(resource.path);
      const bytes = existing ?? (await download(fetchImpl, resource));

      if (!existing) {
        files.set(resource.path, bytes);
        downloaded.push(resource.url);
        if (options.cacheRoot) {
          await writeToFolder(options.cacheRoot, resource.path, bytes);
        }
      }

      if (extensionOf(resource.path) !== 'css') continue;

      for (const url of nestedUrls(decodeText(bytes))) {
        if (byUrl.has(url)) continue;

        const discovered: VendoredResource = { url, path: uniquePath(url, byUrl) };
        byUrl.set(url, discovered.path);
        vendor.push(discovered);
        next.push(discovered);
      }
    }

    queue = next;
  }

  return { files, vendor, downloaded };
}

async function download(
  fetchImpl: typeof fetch,
  resource: VendoredResource,
): Promise<Uint8Array> {
  let response: Response;

  try {
    response = await fetchImpl(resource.url, {
      // Google fonts vraća različit CSS prema `User-Agent`; tražimo woff2 varijantu.
      headers: { 'User-Agent': 'Mozilla/5.0 (pozivnica-uvoznik)' },
    });
  } catch (error) {
    throw new ImportError(
      `Preuzimanje „${resource.url}” nije uspelo (${String(error)}).\n` +
        `Ako nema mreže, snimi fajl ručno kao „${resource.path}” u folder uvoza i ` +
        'pokreni uvoz ponovo.',
    );
  }

  if (!response.ok) {
    throw new ImportError(
      `Preuzimanje „${resource.url}” nije uspelo (HTTP ${response.status}).`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESOURCE_BYTES) {
    throw new ImportError(
      `Fajl „${resource.url}” je veći od ${MAX_RESOURCE_BYTES / (1024 * 1024)} MB.`,
    );
  }

  return bytes;
}

function nestedUrls(css: string): string[] {
  const urls = new Set<string>();

  for (const match of css.matchAll(NESTED_URL)) {
    const url = match[1] ?? match[2];
    if (url) urls.add(url);
  }

  return [...urls];
}

/**
 * Putanja za resurs otkriven unutar preuzetog CSS-a.
 *
 * Ime se izvodi iz same adrese da bi folder ostao čitljiv operatoru. Sudari se
 * razrešavaju **samo** u odnosu na druge preuzete resurse, nikad u odnosu na
 * fajlove u folderu: fajl koji već stoji na toj putanji je keš prethodnog
 * preuzimanja iste adrese, pa ga treba iskoristiti, a ne zaobići pod novim
 * imenom. Bez toga bi svako pokretanje uvoza pravilo `probni-2.woff2`,
 * `probni-3.woff2` i tako redom.
 */
function uniquePath(url: string, byUrl: Map<string, string>): string {
  const name = path.posix
    .basename(new URL(url).pathname)
    .replace(/[^\w.-]/g, '-')
    .slice(-60);

  const base = name === '' || !CONTENT_TYPES[extensionOf(name)] ? 'resurs.bin' : name;
  const taken = new Set(byUrl.values());

  let candidate = `vendor/${base}`;
  let counter = 2;
  while (taken.has(candidate)) {
    const extension = path.posix.extname(base);
    candidate = `vendor/${path.posix.basename(base, extension)}-${counter}${extension}`;
    counter += 1;
  }

  return candidate;
}

/** Snimanje u folder uvoza, da sledeće pokretanje ne ide na mrežu. */
async function writeToFolder(
  root: string,
  relative: string,
  bytes: Uint8Array,
): Promise<void> {
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new ImportError(`Putanja „${relative}” izlazi iz foldera uvoza.`);
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
