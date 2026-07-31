import { expect, test } from './fixtures';

/**
 * Pristanak na kolačiće (zahtev 29).
 *
 * Test čuva ono što se najlakše pokvari: da se merenje ne dešava pre odluke i
 * da odbijanje nije teže od prihvatanja.
 */
test.describe('pristanak na kolačiće', () => {
  test('traka nudi dva ravnopravna izbora i pamti odluku', async ({ page }) => {
    await page.goto('/');

    const banner = page.getByRole('region', { name: 'Kolačići' });
    await expect(banner).toBeVisible();

    // Oba dugmeta postoje i vidljiva su bez skrolovanja kroz sitan tekst.
    await expect(banner.getByRole('button', { name: 'Samo neophodno' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Prihvati sve' })).toBeVisible();

    await banner.getByRole('button', { name: 'Samo neophodno' }).click();
    await expect(banner).toBeHidden();

    // Odluka preživljava osvežavanje - traka se ne vraća.
    await page.reload();
    await expect(page.getByRole('region', { name: 'Kolačići' })).toBeHidden();
  });

  test('pre odluke se ne upisuje oznaka merenja', async ({ page }) => {
    await page.goto('/');

    const cookies = await page.context().cookies();
    const consent = cookies.find((cookie) => cookie.name === 'pozivnica_pristanak');

    // Traka sama po sebi ništa ne upisuje - kolačić nastaje tek klikom.
    expect(consent).toBeUndefined();
  });

  test('stranica o kolačićima nabraja svaki upis i menja odluku', async ({ page }) => {
    await page.goto('/kolacici');

    await expect(
      page.getByRole('heading', { name: 'Kolačići i čuvanje u pregledaču' }),
    ).toBeVisible();

    // Spisak se pravi iz istog izvora po kom se kod i ponaša.
    await expect(page.getByText('authjs.session-token')).toBeVisible();
    await expect(page.getByText('pozivnica-poseta-<pozivnica>')).toBeVisible();

    await page.getByRole('button', { name: 'Uključi merenje' }).click();
    await expect(page.getByText('Merenje je uključeno')).toBeVisible();

    // Opoziv je jednako dostupan kao i pristanak.
    await page.getByRole('button', { name: 'Isključi merenje' }).click();
    await expect(page.getByText('Samo neophodno')).toBeVisible();
  });
});
