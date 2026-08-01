import { expect, test } from '@playwright/test';

/**
 * Galerija šablona, filteri i demo (zahtev 6 i 7).
 *
 * Brojevi su namerno tačni, a ne „bar toliko": galerija koja prikaže šablon
 * viška ili manjka je greška koju treba videti. E2E okruženje ima osam seed
 * šablona i jedan uvezen HTML šablon, koji `global-setup` uveze pravim CLI-jem -
 * dakle devet ukupno, od toga tri za venčanje.
 */
const SVI_SABLONI = 9;
const VENCANJE_SABLONI = 3;

test.describe('galerija šablona', () => {
  test('prikazuje šablone i broj rezultata', async ({ page }) => {
    await page.goto('/sabloni');

    await expect(page.getByRole('heading', { name: 'Galerija šablona' })).toBeVisible();
    await expect(page.locator('[data-template-slug]')).toHaveCount(SVI_SABLONI);
  });

  test('filtriranje po vrsti proslave sužava izbor', async ({ page }) => {
    await page.goto('/sabloni/vencanje');

    await expect(page.getByRole('heading', { level: 1, name: 'Venčanje' })).toBeVisible();
    await expect(page.locator('[data-template-slug]')).toHaveCount(VENCANJE_SABLONI);
  });

  test('filter se čuva u URL-u i može se podeliti linkom', async ({ page }) => {
    await page.goto('/sabloni');

    await page.getByLabel('Fotografije').selectOption('ne');
    await expect(page).toHaveURL(/fotografije=ne/);

    // Direktno otvaranje istog URL-a daje isti rezultat.
    const count = await page.locator('[data-template-slug]').count();
    await page.goto('/sabloni?fotografije=ne');
    await expect(page.locator('[data-template-slug]')).toHaveCount(count);
  });

  test('poništavanje filtera vraća sve šablone', async ({ page }) => {
    await page.goto('/sabloni?fotografije=ne');
    await page.getByRole('link', { name: 'Poništi filtere' }).click();

    await expect(page).toHaveURL(/\/sabloni$/);
    await expect(page.locator('[data-template-slug]')).toHaveCount(SVI_SABLONI);
  });

  test('omiljeni se pamte i filtriraju', async ({ page }) => {
    await page.goto('/sabloni');

    const firstCard = page.locator('[data-template-slug]').first();
    const slug = await firstCard.getAttribute('data-template-slug');

    await firstCard.getByRole('button', { name: 'Sačuvaj u omiljene' }).click();
    await expect(
      firstCard.getByRole('button', { name: 'Ukloni iz omiljenih' }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Samo omiljeni/ }).click();

    // Vidljiv ostaje samo označeni šablon.
    await expect(page.locator(`[data-template-slug="${slug}"]`)).toBeVisible();
    await expect(page.locator('[data-template-slug]:visible')).toHaveCount(1);

    // Izbor preživljava osvežavanje (čuva se u localStorage).
    await page.reload();
    await expect(
      page.locator(`[data-template-slug="${slug}"]`).getByRole('button', {
        name: 'Ukloni iz omiljenih',
      }),
    ).toBeVisible();
  });
});

test.describe('detaljna stranica i demo', () => {
  test('prikazuje uživo pregled pozivnice', async ({ page }) => {
    await page.goto('/sabloni/vencanje/vencanje-editorial-minimal');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Editorial minimal' }),
    ).toBeVisible();

    // Pozivnica se stvarno renderuje, sa sadržajem iz šablona.
    const invitation = page.locator('.invitation-root');
    await expect(invitation).toBeVisible();
    await expect(invitation.getByText('Milica i Stefan').first()).toBeVisible();
    await expect(invitation.getByText('Opština Stari grad')).toBeVisible();
  });

  test('prebacivanje uređaja menja širinu pregleda', async ({ page }) => {
    await page.goto('/sabloni/vencanje/vencanje-editorial-minimal');

    const frame = page.locator('.invitation-root').locator('..').locator('..');
    const desktopWidth = (await frame.boundingBox())?.width ?? 0;

    await page.getByRole('button', { name: 'Telefon' }).click();
    await page.waitForTimeout(400);

    const phoneWidth = (await frame.boundingBox())?.width ?? 0;
    expect(phoneWidth).toBeLessThan(desktopWidth);
  });

  test('demo prikazuje RSVP formu kao onemogućen pregled', async ({ page }) => {
    await page.goto('/demo/vencanje-editorial-minimal');

    await expect(
      page.getByText('Ovako gost vidi formu. U demo prikazu odgovor se ne šalje.'),
    ).toBeVisible();

    // Polja su onemogućena: demo ne sme da ostavi utisak da odgovor stiže.
    await expect(page.getByLabel('Ime i prezime')).toBeDisabled();
  });

  test('pogrešna vrsta proslave u putanji vraća 404', async ({ page }) => {
    const response = await page.goto('/sabloni/krstenje/vencanje-editorial-minimal');
    expect(response?.status()).toBe(404);
  });

  test('demo nije indeksiran', async ({ page }) => {
    await page.goto('/demo/vencanje-editorial-minimal');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });
});

test.describe('marketing stranice', () => {
  test('cenovnik prikazuje pakete iz baze', async ({ page }) => {
    await page.goto('/cenovnik');

    await expect(page.getByRole('heading', { level: 1, name: 'Cenovnik' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Standard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible();
  });

  test('česta pitanja se otvaraju bez JavaScripta', async ({ page }) => {
    await page.goto('/cesta-pitanja');

    const first = page.locator('details').first();
    await expect(first).not.toHaveAttribute('open', '');

    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
  });

  test('pravne stranice jasno kažu da su radna verzija', async ({ page }) => {
    await page.goto('/politika-privatnosti');
    await expect(page.getByText(/radna verzija/)).toBeVisible();

    await page.goto('/uslovi-koriscenja');
    await expect(page.getByText(/radna verzija/)).toBeVisible();
  });

  test('sitemap ne sadrži privatne stranice', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('/sabloni');
    expect(body).not.toContain('/app/');
    expect(body).not.toContain('/demo/');
  });
});
