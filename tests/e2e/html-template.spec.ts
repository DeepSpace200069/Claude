import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

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
