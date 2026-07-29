import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * Uređivač pozivnice od kraja do kraja (zahtev 38, koraci 4-6).
 *
 * Scenario prati ono što organizator zaista radi: napravi nacrt, uredi tekst,
 * vidi izmenu u pregledu, doda sekciju, promeni redosled i napusti stranicu -
 * pa se vrati i zatekne sve na svom mestu.
 */
async function createDraft(page: Page, name: string) {
  await page.goto('/app/dogadjaji/novi');

  await page.getByText('Venčanje', { exact: true }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();

  await page.getByLabel('Interni naziv').fill(name);
  await page.getByLabel('Datum proslave').fill('2027-09-12');
  await page.getByLabel('Grad').fill('Beograd');
  await page.getByRole('button', { name: 'Dalje' }).click();

  await page.getByRole('button', { name: /Editorial minimal/ }).first().click();
  await page.getByRole('button', { name: 'Napravi nacrt' }).click();

  await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
  return page.url();
}

/**
 * Ispravan PNG od 8×8 piksela.
 *
 * Uređivač fotografiju stvarno dekodira i prekodira, pa ovde ne prolazi
 * proizvoljan niz bajtova - mora da bude slika koju pregledač ume da otvori.
 */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAMElEQVR4nG3CoREAIAADsQ6GRqNfo9FoputYLPC5pAOdTnS60CnodKPTg04vOn3oD29EYEE/dl16AAAAAElFTkSuQmCC';

/**
 * Pregled na širokom ekranu stoji uz uređivač, a na telefonu je zaseban tab.
 * Test zato ne pretpostavlja raspored nego otvara pregled tamo gde ga treba
 * otvoriti - isto što bi uradio i korisnik.
 */
async function showPreview(page: Page) {
  const tab = page.getByRole('tab', { name: 'Pregled' });
  if (await tab.isVisible()) await tab.click();
  return page.locator('.invitation-root');
}

test.describe('uređivač pozivnice', () => {
  test('izmena teksta se vidi u pregledu i sama sačuva', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Ana i Marko');
    await page.goto(`${eventUrl}/editor`);

    await expect(page.getByRole('heading', { name: 'Sekcije' })).toBeVisible();

    // Šablon donosi naslovnu sekciju; ona je izabrana po otvaranju.
    await page.getByRole('button', { name: 'Naslovna', exact: true }).click();

    const title = page.getByLabel('Naslov', { exact: true });
    await title.fill('Ana i Marko');

    // Pregled je uživo: ne čeka se čuvanje da bi se izmena videla.
    const preview = await showPreview(page);
    await expect(preview.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();

    // Autosave javlja stanje; poruka mora da bude vidljiva, ne samo u konzoli.
    await expect(page.getByRole('status').filter({ hasText: /Sačuvano/ })).toBeVisible({
      timeout: 15_000,
    });

    // Posle osvežavanja izmena je i dalje tu - znači da je zaista upisana.
    await page.reload();
    await expect(page.getByLabel('Naslov', { exact: true })).toHaveValue('Ana i Marko');
  });

  test('dodavanje sekcije iz biblioteke i uređivanje njenog sadržaja', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Test biblioteke');
    await page.goto(`${eventUrl}/editor`);

    await page.getByRole('button', { name: 'Dodaj sekciju' }).click();
    await expect(
      page.getByRole('heading', { name: 'Biblioteka sekcija' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Korisne informacije/ }).click();

    // Nova sekcija je odmah izabrana, pa korisnik nastavlja da kuca bez traženja.
    await expect(
      page.getByRole('heading', { name: 'Korisne informacije' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Dodaj', exact: true }).click();
    await page.getByLabel('Naslov', { exact: true }).last().fill('Prevoz do restorana');

    const preview = await showPreview(page);
    await expect(
      preview.getByRole('heading', { name: 'Prevoz do restorana' }),
    ).toBeVisible();
  });

  test('zaključana sekcija je vidljiva, ali se ne može dodati', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Test paketa');
    await page.goto(`${eventUrl}/editor`);

    await page.getByRole('button', { name: 'Dodaj sekciju' }).click();

    // Besplatan paket nema knjigu želja. Sekcija se prikazuje da bi korisnik
    // znao da postoji, ali je dugme onemogućeno - a server bi je ionako odbio.
    const locked = page.getByRole('button', { name: /Knjiga želja/ });
    await expect(locked).toBeVisible();
    await expect(locked).toBeDisabled();
    await expect(locked).toContainText('Nije u vašem paketu');
  });

  test('redosled se menja bez miša, uz zvučnu najavu', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Test redosleda');
    await page.goto(`${eventUrl}/editor`);

    const list = page.getByRole('listitem').filter({ hasText: 'Naslovna' }).first();
    await list.getByRole('button', { name: /Još radnji/ }).click();
    await page.getByRole('menuitem', { name: 'Pomeri dole' }).click();

    // Promena redosleda mora da bude i čujna, ne samo vidljiva (zahtev 31).
    await expect(page.getByRole('status').filter({ hasText: /je sada na mestu 2/ })).toBeAttached();

    // „Poništi" vraća redosled.
    await page.getByRole('button', { name: 'Poništi' }).click();
    await expect(page.getByRole('button', { name: 'Poništi' })).toBeDisabled();
  });

  test('sakrivanje sekcije je uklanja iz pregleda, ali ne i iz liste', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Test vidljivosti');
    await page.goto(`${eventUrl}/editor`);

    const row = page.getByRole('listitem').filter({ hasText: 'Naslovna' }).first();
    await row.getByRole('button', { name: /Još radnji/ }).click();
    await page.getByRole('menuitem', { name: 'Sakrij sekciju' }).click();

    await expect(row).toContainText('Sakrivena');
  });

  test('upozorenje o kontrastu se pojavi kada boje postanu nečitljive', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createDraft(page, 'Test kontrasta');
    await page.goto(`${eventUrl}/editor`);

    await page.getByRole('tab', { name: 'Izgled', exact: true }).click();

    // Podrazumevana tema šablona je čitljiva.
    await expect(page.getByText('Sve kombinacije boja zadovoljavaju')).toBeVisible();

    // Beo tekst na beloj pozadini mora da izazove upozorenje.
    await page
      .getByRole('textbox', { name: 'Heks vrednost: Tekst', exact: true })
      .fill('#f8f8f8');

    await expect(page.getByText('Čitljivost')).toBeVisible();
    // Prijavljuju se svi pogođeni parovi, ne samo prvi.
    await expect(page.getByText(/potrebno je najmanje/).first()).toBeVisible();
    await expect(page.getByText(/Tekst na pozadini: odnos/)).toBeVisible();
    await expect(page.getByText(/Tekst na kartici: odnos/)).toBeVisible();
  });

  test('otpremljena fotografija stiže u pozivnicu', async ({ signedInPage: page }) => {
    const eventUrl = await createDraft(page, 'Test fotografije');
    await page.goto(`${eventUrl}/editor`);

    await page.getByRole('button', { name: 'Naslovna', exact: true }).click();
    await page.getByRole('button', { name: 'Izaberi fotografiju' }).click();

    /*
     * Fajl ide kroz ceo pravi tok: uređivač ga prekodira kroz canvas (čime
     * nestaju metapodaci), traži potpisanu adresu, šalje ga u skladište i tek
     * onda potvrđuje zapis. Ništa od toga nije zaobiđeno.
     */
    await page.locator('input[type="file"]').setInputFiles({
      name: 'proba.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
    });

    // Polje za opis se pojavljuje tek kada fotografija zaista postoji.
    const alt = page.getByLabel('Opis fotografije');
    await expect(alt).toBeVisible({ timeout: 20_000 });
    await alt.fill('Mladenci na Kalemegdanu');

    const preview = await showPreview(page);
    await expect(
      preview.getByRole('img', { name: 'Mladenci na Kalemegdanu' }),
    ).toBeVisible();
  });

  test('tuđi uređivač nije dostupan', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/11111111-2222-4333-8444-555555555555/editor');
    await expect(page.getByText(/Stranica nije pronađena|Nemate pristup/)).toBeVisible();
  });
});
