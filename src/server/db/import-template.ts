import 'dotenv/config';

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { analyzeSite } from '@/server/import/analyze';
import { buildTemplate } from '@/server/import/build';
import { ImportError } from '@/server/import/errors';
import { readSiteFiles } from '@/server/import/files';
import { parseManifest } from '@/server/import/manifest';
import { assetUrlFor, newVersionId, saveTemplate } from '@/server/import/persist';
import { vendorResources } from '@/server/import/vendor';

/**
 * Uvoz gotovog HTML sajta kao šablona (zahtev 39.3).
 *
 *     pnpm template:import imports/salas-137 --analiza
 *     pnpm template:import imports/salas-137
 *
 * Prvi poziv napiše `template.json` sa predlogom; drugi ga pročita i uveze.
 *
 * **Uvoz je isključivo administratorska radnja preko CLI-ja.** Korisnici
 * platforme ne otpremaju svoj HTML - to bi bio servis za XSS, jer se šablon
 * servira sa našeg domena, u istom poreklu kao i sesija svakog organizatora.
 * Zato ovde nema rute, nema forme i nema akcije: samo skripta koju pokreće neko
 * ko već ima pristup bazi.
 *
 * Uvoz je idempotentan po slug-u: drugo pokretanje zamenjuje radnu verziju
 * istog šablona, a objavljene verzije ne dira.
 */

type Options = {
  folder: string;
  analyzeOnly: boolean;
  offline: boolean;
};

function parseArguments(argv: string[]): Options {
  const positional = argv.filter((argument) => !argument.startsWith('--'));
  const flags = new Set(argv.filter((argument) => argument.startsWith('--')));

  const folder = positional[0];
  if (!folder) {
    throw new ImportError(
      'Nedostaje folder.\n' +
        '  pnpm template:import imports/<ime-sajta> --analiza\n' +
        '  pnpm template:import imports/<ime-sajta>',
    );
  }

  return {
    folder: path.resolve(process.cwd(), folder),
    analyzeOnly: flags.has('--analiza') || flags.has('--analyze'),
    offline: flags.has('--offline'),
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const slug = path.basename(options.folder);
  const manifestPath = path.join(options.folder, 'template.json');

  const files = await readSiteFiles(options.folder).catch(() => {
    throw new ImportError(`Folder „${options.folder}” ne postoji ili se ne može pročitati.`);
  });

  if (files.size === 0) {
    throw new ImportError(`Folder „${options.folder}” je prazan.`);
  }

  if (options.analyzeOnly) {
    await analyze({ files, manifestPath, slug });
    return;
  }

  await runImport({ ...options, files, manifestPath });
}

async function analyze(input: {
  files: Awaited<ReturnType<typeof readSiteFiles>>;
  manifestPath: string;
  slug: string;
}): Promise<void> {
  const entry = findEntry(input.files);
  const report = analyzeSite({ files: input.files, entry, slug: input.slug });

  await writeFile(input.manifestPath, `${JSON.stringify(report.manifest, null, 2)}\n`, {
    // Postojeći `template.json` se ne prepisuje: u njemu je ljudski rad.
    flag: 'wx',
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') {
      throw new ImportError(
        `„${input.manifestPath}” već postoji. Obriši ga ako želiš nov predlog.`,
      );
    }
    throw error;
  });

  console.log('Predlog je upisan u %s', input.manifestPath);
  console.log('Ulazni fajl: %s', entry);
  for (const note of report.notes) console.log('  • %s', note);
  console.log('\nPregledaj fajl, pa pokreni uvoz bez `--analiza`.');
}

async function runImport(input: Options & {
  files: Awaited<ReturnType<typeof readSiteFiles>>;
  manifestPath: string;
}): Promise<void> {
  const raw = await readFile(input.manifestPath, 'utf8').catch(() => {
    throw new ImportError(
      `Nema „${input.manifestPath}”. Pokreni prvo uvoz sa --analiza.`,
    );
  });

  const manifest = parseManifest(JSON.parse(raw) as unknown);

  const vendored = await vendorResources({
    cacheRoot: input.folder,
    files: input.files,
    vendor: manifest.vendor,
    ...(input.offline ? { fetchImpl: refuseNetwork } : {}),
  });

  for (const url of vendored.downloaded) console.log('  preuzeto: %s', url);

  const versionId = newVersionId();
  const built = buildTemplate({
    manifest: { ...manifest, vendor: vendored.vendor },
    files: vendored.files,
    assetUrl: assetUrlFor(versionId),
  });

  for (const warning of built.warnings) console.warn('  upozorenje: %s', warning);

  const saved = await saveTemplate({ manifest, built, versionId });

  console.log(
    '\n%s „%s” (verzija %d, radna).',
    saved.created ? 'Napravljen šablon' : 'Ažuriran šablon',
    manifest.slug,
    saved.version,
  );
  console.log('  polja: %d', built.fieldDefinitions.fields.length);
  console.log('  fajlova: %d', built.assets.length);
  if (built.inlined.length > 0) {
    console.log('  ugrađeno u dokument: %s', built.inlined.join(', '));
  }
  if (saved.replacedAssets > 0) {
    console.log('  obrisano fajlova prethodne radne verzije: %d', saved.replacedAssets);
  }
  console.log('\nŠablon je radna verzija - objavi ga iz admin panela.');
}

/** `--offline`: uvoz sme da koristi samo ono što je već u folderu. */
function refuseNetwork(): never {
  throw new ImportError(
    'Pokrenuto je sa --offline, a neki resurs nije u folderu. Snimi ga ručno ili ' +
      'pokreni bez --offline.',
  );
}

function findEntry(files: Awaited<ReturnType<typeof readSiteFiles>>): string {
  if (files.has('index.html')) return 'index.html';

  const candidates = [...files.keys()].filter(
    (file) => /\.html?$/i.test(file) && !file.includes('/'),
  );

  if (candidates.length === 1 && candidates[0]) return candidates[0];

  throw new ImportError(
    'Nije jasno koji je ulazni fajl. Očekivan je `index.html` u korenu foldera.',
  );
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    if (error instanceof ImportError) {
      console.error('\nUvoz je prekinut.\n%s', error.message);
      process.exit(1);
    }

    console.error('Uvoz nije uspeo:', error);
    process.exit(1);
  },
);
