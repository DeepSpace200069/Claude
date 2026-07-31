import { expect, sql, test } from './fixtures';

/**
 * Privatnost (zahtev 25).
 *
 * Preuzimanje i brisanje se testiraju kroz interfejs jer se tu i obećavaju:
 * stranica profila kaže „preuzmite kopiju” i „obrišite nalog”, pa mora da radi
 * baš to, i to bez lažnog uspeha.
 */
test.describe('moji podaci', () => {
  test('preuzimanje vraća JSON sa podacima naloga', async ({
    signedInPage: page,
    testUser,
  }) => {
    await page.goto('/app/profil');
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();

    const link = page.getByRole('link', { name: 'Preuzmi moje podatke' });
    await expect(link).toBeVisible();

    // Fajl se preuzima običnom vezom, pa radi i bez JavaScripta.
    const response = await page.request.get('/app/profil/podaci');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(response.headers()['cache-control']).toContain('no-store');

    const data = (await response.json()) as {
      format: string;
      profile: { email: string };
    };

    expect(data.format).toBe('pozivnica-export');
    expect(data.profile.email).toBe(testUser.email);
  });

  test('neprijavljen posetilac ne može da preuzme tuđe podatke', async ({
    request,
  }) => {
    const response = await request.get('/app/profil/podaci');
    expect(response.status()).toBe(401);
  });

  test('brisanje naloga traži ukucanu potvrdu i zaista briše', async ({
    signedInPage: page,
    testUser,
  }) => {
    await page.goto('/app/profil');
    await page.getByRole('button', { name: 'Obriši nalog' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Bez ukucane reči dugme ne radi ništa - potvrda nije formalnost.
    const confirmButton = dialog.getByRole('button', { name: 'Obriši nalog' });
    await expect(confirmButton).toBeDisabled();

    await dialog.getByLabel(/Ukucajte/).fill('možda');
    await confirmButton.click();
    await expect(dialog.getByText('Ukucajte OBRIŠI.')).toBeVisible();

    await dialog.getByLabel(/Ukucajte/).fill('OBRIŠI');
    await confirmButton.click();

    // Posle brisanja korisnik više nije u aplikaciji.
    await expect(page).toHaveURL(/\/$/);

    const [row] = await sql<{ email: string; deleted_at: string | null }[]>`
      select email, deleted_at from users where id = ${testUser.id}
    `;

    expect(row?.email).not.toBe(testUser.email);
    expect(row?.email).toContain('obrisano.invalid');
    expect(row?.deleted_at).not.toBeNull();
  });
});
