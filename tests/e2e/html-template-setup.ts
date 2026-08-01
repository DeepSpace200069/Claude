import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { sql } from './fixtures';

/**
 * Uvoz probnog HTML šablona za E2E (zahtev 39.3 i 39.5).
 *
 * Šablon se ne priprema SQL-om nego se **stvarno uveze**, istim CLI-jem koji
 * koristi operator. Zahvaljujući tome test proverava i uvoznik: da dokument koji
 * on napravi zaista može da se uredi i prikaže. Ručno napisan red u bazi bi
 * proveravao samo ono što test sam napiše.
 *
 * Folder se pre uvoza kopira u privremeni: uvoz u njega snima preuzete resurse,
 * a uzorak u repozitorijumu treba da ostane onakav kakav je. U kopiju se upisuju
 * i „preuzeti" fajlovi, pa uvoz radi bez mreže (`--offline`) - E2E ne sme da
 * zavisi od tuđeg CDN-a.
 */
const execFileAsync = promisify(execFile);

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/sajt-proba');

/** Zamene za resurse koje bi uvoz inače preuzeo sa interneta. */
const VENDORED: Record<string, string> = {
  'vendor/animacije-1.0.js': 'window.animacije = function () {};\n',
  'vendor/fontovi.css':
    "@font-face{font-family:'Probni';src:url(https://fonts.gstatic.test/probni.woff2) format('woff2')}\n",
  'vendor/probni.woff2': 'wOF2',
};

export type ImportedTemplate = { templateId: string; slug: string };

/**
 * Uvozi i **objavljuje** probni šablon; ako već postoji, samo ga vrati.
 *
 * Objavljivanje je inače administratorska radnja iz panela; ovde je SQL, jer je
 * predmet testa ono što dolazi posle - uređivač i javni prikaz.
 */
export async function ensureHtmlTemplate(): Promise<ImportedTemplate> {
  const slug = 'proba-vencanje';

  const existing = await sql<{ id: string; published: string | null }[]>`
    select id, published_version_id as published from templates where slug = ${slug}
  `;

  if (existing[0]?.published) {
    return { templateId: existing[0].id, slug };
  }

  const folder = await mkdtemp(path.join(tmpdir(), 'sajt-proba-'));

  try {
    await cp(FIXTURE, folder, { recursive: true });

    for (const [relative, content] of Object.entries(VENDORED)) {
      const target = path.join(folder, relative);
      await execFileAsync('mkdir', ['-p', path.dirname(target)]);
      await writeFile(target, content);
    }

    await execFileAsync('pnpm', ['template:import', folder, '--offline'], {
      cwd: process.cwd(),
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }

  const [template] = await sql<{ id: string }[]>`
    select id from templates where slug = ${slug}
  `;
  if (!template) throw new Error('Probni HTML šablon nije uvezen.');

  const [version] = await sql<{ id: string }[]>`
    select id from template_versions
    where template_id = ${template.id}
    order by version desc
    limit 1
  `;
  if (!version) throw new Error('Verzija probnog šablona ne postoji.');

  await sql`
    update template_versions
    set status = 'published', published_at = now()
    where id = ${version.id}
  `;
  await sql`
    update templates
    set status = 'published', published_version_id = ${version.id}
    where id = ${template.id}
  `;

  return { templateId: template.id, slug };
}
