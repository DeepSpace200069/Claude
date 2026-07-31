import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import type { Page } from '@playwright/test';

import { expect, sql, test } from './fixtures';

/**
 * Revizija pristupačnosti (zahtev 22 i 31).
 *
 * Automatska provera ne zamenjuje ručnu - `axe` hvata otprilike trećinu
 * problema i ne zna ništa o smislu teksta ni o redosledu fokusa. Ono što hvata
 * hvata pouzdano, pa je ovde kao zaštita od regresije: svaka nova stranica
 * mora da prođe bez ijedne prijave nivoa A i AA.
 *
 * Ručno su proverene stvari koje alat ne vidi: prečica do sadržaja, redosled
 * fokusa u dijalozima, čitljivost poruka o greškama i alternativa prevlačenju u
 * rasporedu sedenja (postoji kao `<select>`, testirana u `seating.spec.ts`).
 */
/*
 * Playwright ovaj fajl učitava kao CommonJS, pa `import.meta` nije dostupan;
 * `__filename` jeste, pa se `createRequire` vezuje za njega.
 */
const resolveFrom = createRequire(pathToFileURL(__filename));
const AXE_PATH = resolveFrom.resolve('axe-core');

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[] }>;
};

/** Pokreće axe nad učitanom stranicom i vraća prijave nivoa A i AA. */
async function analyze(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_PATH });

  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: unknown,
            options: unknown,
          ) => Promise<{ violations: AxeViolation[] }>;
        };
      }
    ).axe;

    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    return result.violations;
  });
}

function describeViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'nepoznato'}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(' '))
          .join('\n  ')}`,
    )
    .join('\n');
}

test.describe('pristupačnost javnih stranica', () => {
  const publicPages = [
    ['početna', '/'],
    ['šabloni', '/sabloni'],
    ['cenovnik', '/cenovnik'],
    ['česta pitanja', '/cesta-pitanja'],
    ['kolačići', '/kolacici'],
    ['politika privatnosti', '/politika-privatnosti'],
    ['prijava', '/login'],
  ] as const;

  for (const [name, path] of publicPages) {
    test(`${name} nema prijava nivoa A i AA`, async ({ page }) => {
      await page.goto(path);
      const violations = await analyze(page);

      expect(describeViolations(violations)).toBe('');
    });
  }
});

test.describe('pristupačnost aplikacije', () => {
  test('lista događaja i profil nemaju prijava', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji');
    expect(describeViolations(await analyze(page))).toBe('');

    await page.goto('/app/profil');
    expect(describeViolations(await analyze(page))).toBe('');
  });

  test('čarobnjak nema prijava ni u jednom koraku', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/novi');
    expect(describeViolations(await analyze(page))).toBe('');

    await page.getByText('Rođendan', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    expect(describeViolations(await analyze(page))).toBe('');
  });

  test('spisak gostiju i odgovori nemaju prijava', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/novi');
    await page.getByText('Rođendan', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByLabel('Interni naziv').fill('Pristupačnost');
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Napravi nacrt' }).click();
    await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);

    const eventUrl = page.url();

    for (const path of ['gosti', 'odgovori', 'objavljivanje', 'naplata']) {
      await page.goto(`${eventUrl}/${path}`);
      expect(describeViolations(await analyze(page))).toBe('');
    }
  });

  test('otvoren dijalog zadržava ispravnu strukturu', async ({
    signedInPage: page,
  }) => {
    await page.goto('/app/profil');
    await page.getByRole('button', { name: 'Obriši nalog' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect(describeViolations(await analyze(page))).toBe('');
  });
});

test.describe('pristupačnost javne pozivnice', () => {
  test('objavljena pozivnica nema prijava', async ({ page, testUser }) => {
    const slug = `pristupacnost-${Date.now()}`;

    const [type] = await sql<{ id: string }[]>`
      select id from event_types where key = 'wedding' limit 1
    `;

    const [event] = await sql<{ id: string }[]>`
      insert into events (owner_id, event_type_id, name, details, starts_at, time_zone, city, venue_name, primary_locale)
      values (${testUser.id}, ${type?.id ?? null}, 'Pristupačnost', '{}'::jsonb,
              now() + interval '90 days', 'Europe/Belgrade', 'Beograd', 'Sala', 'sr-Latn')
      returning id
    `;

    const [theme] = await sql<{ theme_tokens: unknown }[]>`
      select tv.theme_tokens from templates t
      join template_versions tv on t.published_version_id = tv.id
      limit 1
    `;

    const [invitation] = await sql<{ id: string }[]>`
      insert into invitations (event_id, public_slug, title, theme_tokens, status, privacy, published_at)
      values (${event?.id ?? null}, ${slug}, 'Ana i Marko',
              ${JSON.stringify(theme?.theme_tokens ?? {})}::jsonb, 'published', 'unlisted', now())
      returning id
    `;

    await sql`
      insert into invitation_sections (invitation_id, type, schema_version, position, is_visible, data)
      values (${invitation?.id ?? null}, 'hero', 1, 0, true,
              ${JSON.stringify({
                eyebrow: 'Pozivamo vas',
                title: 'Ana i Marko',
                subtitle: 'Venčavamo se',
                image: null,
                layout: 'centered',
                overlayOpacity: 25,
                showIntroAnimation: false,
              })}::jsonb)
    `;

    try {
      await page.goto(`/p/${slug}`);
      // Boje pozivnice dolaze iz teme šablona, pa ova provera pokriva i to da
      // zasejana tema zadovoljava AA - isto što uređivač proverava uživo.
      expect(describeViolations(await analyze(page))).toBe('');
    } finally {
      await sql`delete from events where id = ${event?.id ?? null}`;
    }
  });
});
