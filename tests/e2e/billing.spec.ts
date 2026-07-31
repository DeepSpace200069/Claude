import type { Page } from '@playwright/test';

import {
  createSignedInUser,
  deleteUser,
  expect,
  signIn,
  sql,
  test,
} from './fixtures';

/**
 * Objavljivanje kroz naplatu (zahtev 17 i 38).
 *
 * Ovo je scenario koji vezuje celu Fazu 7: besplatan nacrt ne može da se
 * objavi, paket se kupuje **za tu pozivnicu**, a javni link radi tek kada je
 * uplata potvrđena.
 *
 * E2E vrti produkcijski build, u kom je dozvoljen `manual` provajder - onaj
 * koji ništa ne izmišlja, nego ostavlja narudžbinu u čekanju dok je
 * administrator ne potvrdi. Zato scenario prolazi kroz admin panel: to je pravi
 * put kojim uplatnica ili bankovni transfer postaju plaćen paket.
 */
test.describe('naplata i objavljivanje', () => {
  /** Događaj napravljen kroz čarobnjaka - isti put kojim ide i korisnik. */
  async function createEvent(page: Page, name: string): Promise<string> {
    await page.goto('/app/dogadjaji/novi');

    await page.getByText('Rođendan', { exact: true }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByLabel('Interni naziv').fill(name);
    await page.getByLabel('Datum proslave').fill('2027-06-15');
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Napravi nacrt' }).click();

    await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
    return page.url();
  }

  test('nacrt se objavljuje tek kada je paket plaćen', async ({
    signedInPage: page,
    browser,
    baseURL,
  }) => {
    const eventUrl = await createEvent(page, 'Rođendan sa naplatom');
    const eventId = eventUrl.split('/').pop() ?? '';

    // 1. Besplatan paket: dugme postoji, ali je onemogućeno uz razlog.
    await page.goto(`${eventUrl}/objavljivanje`);
    await expect(page.getByRole('button', { name: 'Objavi pozivnicu' })).toBeDisabled();
    await expect(page.getByText('Objavljivanje nije u vašem paketu')).toBeVisible();

    // 2. Veza vodi na naplatu baš te pozivnice, ne na opšti cenovnik.
    await page.getByRole('link', { name: 'Pogledaj pakete' }).click();
    await expect(page).toHaveURL(new RegExp(`/app/dogadjaji/${eventId}/naplata$`));
    await expect(page.getByRole('heading', { name: 'Plan i naplata' })).toBeVisible();
    await expect(page.getByText('Za ovu pozivnicu još nema narudžbina.')).toBeVisible();

    // 3. Kupovina paketa; provajder vraća korisnika na stranicu naplate.
    await page.getByRole('radio', { name: /Premium/ }).check();
    await page.getByRole('button', { name: 'Nastavi na plaćanje' }).click();

    await expect(page).toHaveURL(/naplata=povratak/);
    await expect(page.getByText('Čeka uplatu')).toBeVisible();

    // 4. Narudžbina u čekanju ne daje nikakva prava.
    await page.goto(`${eventUrl}/objavljivanje`);
    await expect(page.getByRole('button', { name: 'Objavi pozivnicu' })).toBeDisabled();

    // 5. Administrator potvrđuje uplatu, uz obavezan razlog.
    const admin = await createSignedInUser({ role: 'admin' });
    const adminContext = await browser.newContext();

    try {
      await signIn(adminContext, admin, baseURL ?? 'http://localhost:3000');
      const adminPage = await adminContext.newPage();

      await adminPage.goto('/admin/narudzbine?status=pending');
      await adminPage.getByRole('button', { name: 'Aktiviraj ručno' }).first().click();

      await expect(
        adminPage.getByRole('heading', { name: 'Ručna aktivacija narudžbine' }),
      ).toBeVisible();

      await adminPage.getByLabel('Razlog').fill('Uplata primljena na račun.');
      await adminPage
        .getByRole('button', { name: 'Aktiviraj ručno' })
        .last()
        .click();

      await expect(adminPage.getByText('Narudžbina je aktivirana.')).toBeVisible();
      await adminPage.close();
    } finally {
      await adminContext.close();
      await deleteUser(admin.id);
    }

    // 6. Paket je aktivan za ovu pozivnicu i objavljivanje sada radi.
    await page.goto(`${eventUrl}/naplata`);
    await expect(page.getByText('Plaćeno')).toBeVisible();

    await page.goto(`${eventUrl}/objavljivanje`);
    const publish = page.getByRole('button', { name: 'Objavi pozivnicu' });
    await expect(publish).toBeEnabled();
    await publish.click();

    await expect(page.getByText('Pozivnica je objavljena.')).toBeVisible();

    // 7. Javni link stvarno radi: gost vidi pozivnicu, a ne poruku da nije
    //    aktivna. Interni naziv se namerno **ne** proverava - njega vidi samo
    //    organizator.
    const [invitation] = await sql<{ public_slug: string }[]>`
      select public_slug from invitations where event_id = ${eventId} limit 1
    `;
    if (!invitation) throw new Error('Pozivnica ne postoji.');

    const response = await page.goto(`/p/${invitation.public_slug}`);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/p/${invitation.public_slug}$`));
    await expect(page.getByText('Pozivnica trenutno nije aktivna')).toHaveCount(0);
    await expect(page.getByText('Pozivnica nije pronađena')).toHaveCount(0);
  });

  test('dvostruko pokretanje naplate ne pravi drugu narudžbinu', async ({
    signedInPage: page,
  }) => {
    const eventUrl = await createEvent(page, 'Rođendan sa dva klika');
    const eventId = eventUrl.split('/').pop() ?? '';

    await page.goto(`${eventUrl}/naplata`);
    await page.getByRole('radio', { name: /Premium/ }).check();
    await page.getByRole('button', { name: 'Nastavi na plaćanje' }).click();
    await expect(page).toHaveURL(/naplata=povratak/);

    // Drugi pokušaj istog paketa nastavlja postojeću narudžbinu.
    await page.getByRole('radio', { name: /Premium/ }).check();
    await page.getByRole('button', { name: 'Nastavi na plaćanje' }).click();
    await expect(page).toHaveURL(/naplata=povratak/);

    const [row] = await sql<{ count: string }[]>`
      select count(*)::text as count from orders where event_id = ${eventId}
    `;
    expect(row?.count).toBe('1');
  });
});
