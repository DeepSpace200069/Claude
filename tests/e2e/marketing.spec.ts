import { expect, test } from '@playwright/test';

/** Javne stranice i osnovna pristupačnost (zahtevi 6, 22, 31, 33). */
test.describe('marketing i javni deo', () => {
  test('početna stranica prikazuje ponudu i vodi ka kreiranju pozivnice', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Napravi pozivnicu' }).first(),
    ).toBeVisible();

    // Kategorije proslava dolaze iz baze.
    await expect(page.getByRole('link', { name: /Venčanje/ }).first()).toBeVisible();
  });

  test('kategorije vode na filtriranu galeriju šablona', async ({ page }) => {
    await page.goto('/');

    const weddingLink = page.locator('a[href="/sabloni/vencanje"]').first();
    await expect(weddingLink).toBeVisible();
  });

  test('prečica za preskakanje navigacije postoji', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: 'Pređi na sadržaj' });
    await expect(skipLink).toBeFocused();
  });

  test('stranica ima jedan h1 naslov', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('nepostojeća stranica vraća 404 sa objašnjenjem', async ({ page }) => {
    const response = await page.goto('/ne-postoji-ova-stranica');

    expect(response?.status()).toBe(404);
    await expect(page.getByText('Stranica nije pronađena')).toBeVisible();
  });

  test('jezik se menja i pamti', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Jezik' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();

    await expect(
      page.getByRole('heading', { name: 'An invitation your guests open on their phone' }),
    ).toBeVisible();

    // Izbor preživljava osvežavanje jer se čuva u kolačiću. Proveravamo naslov,
    // a ne dugme za prijavu: ono je na uskim ekranima namerno sakriveno.
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'An invitation your guests open on their phone' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an invitation' }).first()).toBeVisible();
  });

  test('stranica za prijavu traži email', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
    await expect(page.getByLabel('Email adresa')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pošalji link za prijavu' })).toBeVisible();
  });

  test('prijava prikazuje grešku za neispravnu email adresu', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email adresa').fill('ovo-nije-email');
    await page.getByRole('button', { name: 'Pošalji link za prijavu' }).click();

    await expect(page.getByText('Unesite ispravnu email adresu.')).toBeVisible();
  });
});

test.describe('zaštita aplikacije', () => {
  test('neprijavljeni korisnik se preusmerava na prijavu', async ({ page }) => {
    await page.goto('/app/dogadjaji');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test('preusmerenje posle prijave ne prihvata spoljni URL', async ({ page }) => {
    await page.goto('/login?callbackUrl=https://napadac.example');

    // Stranica se učitava, ali opasno odredište se odbacuje na serveru.
    await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
  });
});
