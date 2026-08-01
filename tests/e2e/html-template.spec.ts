import type { Page } from '@playwright/test';

import { expect, sql, test } from './fixtures';
import { createPublishedHtmlInvitation } from './html-template-setup';

/**
 * Pozivnica napravljena od uvezenog sajta (zahtev 39.4).
 *
 * Scenario prati ono što organizator zaista radi: izabere gotov sajt u
 * čarobnjaku, otvori uređivač i zatekne **formu polja** umesto liste sekcija,
 * izmeni tekst i vidi ga u pregledu bez ponovnog učitavanja, pa se vrati i
 * zatekne izmenu na svom mestu.
 *
 * Šablon uvozi `global-setup` pravim CLI-jem, pa ovo pokriva i uvoznik.
 */
async function createHtmlDraft(page: Page, name: string): Promise<string> {
  await page.goto('/app/dogadjaji/novi');

  await page.getByText('Venčanje', { exact: true }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();

  await page.getByLabel('Interni naziv').fill(name);
  await page.getByLabel('Datum proslave').fill('2027-09-12');
  await page.getByRole('button', { name: 'Dalje' }).click();

  await page.getByRole('button', { name: /Probni sajt/ }).first().click();
  await page.getByRole('button', { name: 'Napravi nacrt' }).click();

  await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
  return page.url();
}

/** Pregled je na telefonu zaseban tab, a na širokom ekranu stalna kolona. */
async function showPreview(page: Page) {
  const tab = page.getByRole('tab', { name: 'Pregled' });
  if (await tab.isVisible()) await tab.click();
  return page.frameLocator('iframe[title="Pregled"]');
}

test.describe('uređivač gotovog sajta', () => {
  test('polja se menjaju, pregled prati, izmena se sama sačuva', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createHtmlDraft(page, 'Ana i Marko, sajt');
    await page.goto(`${eventUrl}/editor`);

    // Uređivač polja, ne uređivač sekcija.
    await expect(page.getByText('Gotov sajt kao pozivnica')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sekcije' })).toHaveCount(0);

    // Podrazumevane vrednosti dolaze iz samog šablona, pa pozivnica odmah
    // izgleda kao demo koji je korisnik izabrao.
    const imena = page.getByLabel('Imena');
    await expect(imena).toHaveValue('Ana i Marko');

    await imena.fill('Milica i Stefan');

    // Pregled se menja uživo, bez ponovnog učitavanja i bez čekanja na čuvanje.
    const preview = await showPreview(page);
    await expect(preview.locator('#imena')).toHaveText('Milica i Stefan');

    await expect(page.getByRole('status').filter({ hasText: /Sačuvano/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByLabel('Imena')).toHaveValue('Milica i Stefan');
  });

  test('vrednost polja ostaje tekst, i kad izgleda kao HTML', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createHtmlDraft(page, 'Provera bekstvovanja');
    await page.goto(`${eventUrl}/editor`);

    await page.getByLabel('Imena').fill('<img src=x onerror="window.__probijeno=1">');

    const preview = await showPreview(page);

    // U prikazu je tekst, a ne oznaka: nijedan `img` nije nastao.
    await expect(preview.locator('#imena')).toContainText('<img src=x');
    await expect(preview.locator('#imena img')).toHaveCount(0);
  });

  test('fajlovi šablona se serviraju sa našeg domena', async ({
    signedInPage: page,
    baseURL,
  }) => {
    const eventUrl = await createHtmlDraft(page, 'Fajlovi šablona');

    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto(`${eventUrl}/editor`);
    await showPreview(page);
    await page.waitForTimeout(1000);

    const external = requests.filter(
      (url) => url.startsWith('http') && !url.startsWith(baseURL ?? 'http://localhost:3000'),
    );

    // Ni jedan zahtev ka tuđem domenu - ni za skriptu, ni za font, ni za sliku.
    expect(external).toEqual([]);
    expect(requests.some((url) => url.includes('/sabloni-fajlovi/'))).toBe(true);
  });
});

/**
 * Gost otvara pozivnicu napravljenu od uvezenog sajta (zahtev 39.4).
 *
 * Ono što se ovde proverava nije „stranica se otvorila" nego da je sajt zaista
 * **isti sajt**: njegov `<html>`, njegovi stilovi, njegove skripte koje se
 * stvarno izvrše. Uz to, na mestu ukrasne forme mora da stoji prava forma, a
 * nijedan zahtev ne sme da ode van našeg domena.
 */
test.describe('gost otvara gotov sajt kao pozivnicu', () => {
  const created: string[] = [];

  test.afterAll(async () => {
    for (const eventId of created) {
      await sql`delete from events where id = ${eventId}`;
    }
  });

  async function publish(
    testUserId: string,
    slug: string,
    values?: Record<string, string>,
  ): Promise<string> {
    const { eventId } = await createPublishedHtmlInvitation({
      ownerId: testUserId,
      slug,
      ...(values ? { values } : {}),
    });
    created.push(eventId);
    return slug;
  }

  test('sajt zadržava svoj dokument, stilove i skripte', async ({
    page,
    testUser,
    baseURL,
  }) => {
    const slug = await publish(testUser.id, `gotov-sajt-${Date.now()}`);

    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto(`/p/${slug}`);

    // Atributi `<html>` i `<body>` su autorovi, ne naši.
    await expect(page.locator('html')).toHaveAttribute('lang', 'sr-Latn');
    await expect(page.locator('body')).toHaveClass(/tamna/);

    // Vrednosti polja su upisane na serveru.
    await expect(page.locator('#imena')).toHaveText('Ana i Marko');

    // Stil šablona se stvarno primenio - naslov nije podrazumevane veličine.
    const fontSize = await page
      .locator('#imena')
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    expect(fontSize).toBeGreaterThan(30);

    // Skripta šablona se izvršila; ona je ta koja pravi animacije.
    await expect(page.locator('body')).toHaveAttribute('data-ucitano', 'da');

    const external = requests.filter(
      (url) =>
        url.startsWith('http') && !url.startsWith(baseURL ?? 'http://localhost:3000'),
    );
    expect(external).toEqual([]);
  });

  test('ugrađena mapa je zamenjena linkom koji gost sam klikće', async ({
    page,
    testUser,
  }) => {
    const slug = await publish(testUser.id, `gotov-sajt-mapa-${Date.now()}`);

    await page.goto(`/p/${slug}`);

    await expect(page.locator('iframe')).toHaveCount(0);

    const card = page.locator('[data-mapa]');
    await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(card).toContainText('Salaš 137');
  });

  test('prava RSVP forma stoji na mestu ukrasne i beleži odgovor', async ({
    page,
    testUser,
  }) => {
    const slug = await publish(testUser.id, `gotov-sajt-rsvp-${Date.now()}`);

    await page.goto(`/p/${slug}`);

    /*
     * Obrazac odbija odgovor poslat u prve dve sekunde - čovek ne popuni ime i
     * broj gostiju tako brzo, pa je to znak automata. Test čeka isto koliko bi
     * čekao i gost.
     */
    await page.waitForTimeout(2500);

    await page.getByLabel('Ime i prezime').fill('Jovana Jovanović');
    await page.getByRole('radio', { name: 'Dolazim', exact: true }).check();
    await page.getByRole('button', { name: 'Pošalji odgovor' }).click();

    await expect(page.getByText('Vaš dolazak je zabeležen.')).toBeVisible();

    const [row] = await sql<{ full_name: string }[]>`
      select r.full_name from rsvp_responses r
      join invitations i on i.id = r.invitation_id
      where i.public_slug = ${slug}
    `;
    expect(row?.full_name).toBe('Jovana Jovanović');
  });

  test('vrednost polja ostaje tekst i na javnoj strani', async ({
    page,
    testUser,
  }) => {
    const slug = await publish(testUser.id, `gotov-sajt-escape-${Date.now()}`, {
      imena: '<img src=x onerror="window.__probijeno = 1">',
    });

    await page.goto(`/p/${slug}`);

    await expect(page.locator('#imena img')).toHaveCount(0);
    await expect(page.locator('#imena')).toContainText('<img src=x');
    expect(await page.evaluate(() => '__probijeno' in window)).toBe(false);
  });
});
