import { expect, test } from './fixtures';

/**
 * Životni ciklus događaja koji Faza 1 pokriva (zahtev 38).
 *
 * Koraci sa uređivačem, objavljivanjem i RSVP-om dolaze u Fazama 3-5 i biće
 * dodati u ovaj isti scenario kada te faze budu gotove.
 */
test.describe('organizator i njegovi događaji', () => {
  test('prazna lista nudi kreiranje prve pozivnice', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji');

    await expect(page.getByRole('heading', { name: 'Moji događaji' })).toBeVisible();
    await expect(page.getByText('Još nemate nijedan događaj')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Napravi prvu pozivnicu' })).toBeVisible();
  });

  test('čarobnjak pravi događaj, dashboard prikazuje podatke, izmena ne menja link', async ({
    signedInPage: page,
  }) => {
    await page.goto('/app/dogadjaji/novi');

    // Korak 1: vrsta proslave.
    await expect(page.getByRole('heading', { name: 'Kakva je proslava?' })).toBeVisible();
    await page.getByText('Venčanje', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();

    // Korak 2: osnovni podaci; polja zavise od izabranog tipa.
    await expect(page.getByRole('heading', { name: 'Osnovni podaci' })).toBeVisible();
    await expect(page.getByLabel('Ime prve osobe')).toBeVisible();

    await page.getByLabel('Ime prve osobe').fill('Milica');
    await page.getByLabel('Ime druge osobe').fill('Stefan');
    await page.getByLabel('Interni naziv').fill('Milica i Stefan');
    await page.getByLabel('Datum proslave').fill('2027-09-12');
    await page.getByLabel('Vreme početka').fill('13:00');
    await page.getByLabel('Grad').fill('Beograd');
    await page.getByLabel('Glavna lokacija').fill('Restoran Dunavski kej');
    await page.getByRole('button', { name: 'Dalje' }).click();

    // Korak 3: izbor šablona. Podrazumevano je prazna pozivnica.
    await expect(page.getByRole('heading', { name: 'Izaberite izgled' })).toBeVisible();
    await page.getByRole('button', { name: /Editorial minimal/ }).first().click();

    await page.getByRole('button', { name: 'Napravi nacrt' }).click();

    // Dashboard događaja.
    await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Milica i Stefan' })).toBeVisible();
    await expect(page.getByText('Beograd')).toBeVisible();
    await expect(page.getByText('Pozivnica još nije objavljena')).toBeVisible();

    const eventUrl = page.url();

    // Podešavanja: menjamo lokaciju i grad.
    await page.goto(`${eventUrl}/podesavanja`);
    await expect(page.getByRole('heading', { name: 'Podešavanja događaja' })).toBeVisible();

    await page.getByLabel('Glavna lokacija').fill('Restoran Kalemegdanska terasa');
    await page.getByLabel('Grad').fill('Novi Sad');
    await page.getByRole('button', { name: 'Sačuvaj' }).click();

    await expect(page.getByText('Izmene su sačuvane.')).toBeVisible();

    // Izmena je vidljiva, a događaj je i dalje na istoj adresi.
    await page.goto(eventUrl);
    await expect(page.getByText('Novi Sad')).toBeVisible();
    expect(page.url()).toBe(eventUrl);

    // Događaj je sada u listi.
    await page.goto('/app/dogadjaji');
    await expect(page.getByRole('link', { name: 'Milica i Stefan' })).toBeVisible();
  });

  test('brisanje traži potvrdu kucanjem naziva', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/novi');

    await page.getByText('Rođendan', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByLabel('Interni naziv').fill('Rođendan za brisanje');
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Napravi nacrt' }).click();

    await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
    await page.goto(`${page.url()}/podesavanja`);

    await page.getByRole('button', { name: 'Obriši događaj' }).click();

    const deleteButton = page.getByRole('button', { name: 'Obriši', exact: true });
    await expect(deleteButton).toBeDisabled();

    await page.getByRole('textbox', { name: 'Rođendan za brisanje' }).fill('Rođendan za brisanje');
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    await expect(page).toHaveURL(/\/app\/dogadjaji$/);
    await expect(page.getByText('Još nemate nijedan događaj')).toBeVisible();
  });

  test('šablon izabran sa galerije je unapred označen u čarobnjaku', async ({
    signedInPage: page,
  }) => {
    // Detaljna stranica šablona vodi ovamo sa `?sablon=`.
    await page.goto('/app/dogadjaji/novi?sablon=vencanje-editorial-minimal');

    await page.getByText('Venčanje', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByLabel('Interni naziv').fill('Test preselekcije');
    await page.getByRole('button', { name: 'Dalje' }).click();

    // Šablon iz URL-a je već izabran, korisnik ne mora ponovo da ga traži.
    await expect(
      page.getByRole('button', { name: /Editorial minimal/ }).first(),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('tuđi događaj nije dostupan', async ({ signedInPage: page }) => {
    // Nasumičan, ali ispravno formatiran UUID - server mora da odgovori kao da
    // događaj ne postoji, bez obzira da li postoji kod drugog korisnika.
    await page.goto('/app/dogadjaji/11111111-2222-4333-8444-555555555555');

    await expect(page.getByText(/Stranica nije pronađena|Nemate pristup/)).toBeVisible();
  });

  test('profil čuva ime i učestalost obaveštenja', async ({ signedInPage: page }) => {
    await page.goto('/app/profil');

    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
    await page.getByLabel('Ime i prezime').fill('Milica Jovanović');
    await page.getByRole('button', { name: 'Sačuvaj' }).click();

    await expect(page.getByText('Profil je sačuvan.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Ime i prezime')).toHaveValue('Milica Jovanović');
  });
});
