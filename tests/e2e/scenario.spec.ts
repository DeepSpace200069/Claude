import { expect, sql, test } from './fixtures';
import { createSignedInUser, deleteUser, signIn } from './fixtures';

/**
 * Ceo scenario iz specifikacije, od posete do rasporeda sedenja (zahtev 38).
 *
 * Ostali E2E testovi proveravaju delove: uređivač, naplatu, goste, raspored.
 * Ovaj proverava ono što nijedan od njih ne može - da se delovi **uklapaju**:
 * da paket kupljen u koraku 4 zaista otključa objavljivanje u koraku 5, da
 * gost koji odgovori u koraku 7 postane ime u spisku odgovora u koraku 8 i da
 * isti taj gost može da se posadi za sto u koraku 9.
 *
 * Zato je namerno **jedan** dugačak test, a ne devet kratkih: stanje se prenosi
 * kroz korake, kao kod pravog korisnika.
 */
test.describe('scenario od kraja do kraja', () => {
  test('od čarobnjaka do rasporeda sedenja', async ({
    signedInPage: page,
    browser,
    baseURL,
  }) => {
    test.slow();

    const url = baseURL ?? 'http://localhost:3000';

    // Spisak gostiju traži paket sa granicom; podiže se kao što bi je podigla
    // kupovina paketa - sama kupovina se proverava u koraku 4.
    await sql`
      update feature_plans
      set features = jsonb_set(features, '{limits,maxGuests}', '200'::jsonb)
      where code = 'free'
    `;

    let eventId = '';

    try {
      // 1. Čarobnjak: vrsta proslave, podaci, šablon.
      await page.goto('/app/dogadjaji/novi');
      await page.getByText('Venčanje', { exact: true }).click();
      await page.getByRole('button', { name: 'Dalje' }).click();

      await page.getByLabel('Ime prve osobe').fill('Ana');
      await page.getByLabel('Ime druge osobe').fill('Marko');
      await page.getByLabel('Interni naziv').fill('Ana i Marko');
      await page.getByLabel('Datum proslave').fill('2027-08-21');
      await page.getByLabel('Vreme početka').fill('16:00');
      await page.getByLabel('Grad').fill('Novi Sad');
      await page.getByLabel('Glavna lokacija').fill('Salaš 137');
      await page.getByRole('button', { name: 'Dalje' }).click();

      await page.getByRole('button', { name: /Editorial minimal/ }).first().click();
      await page.getByRole('button', { name: 'Napravi nacrt' }).click();

      await expect(page).toHaveURL(/\/app\/dogadjaji\/[0-9a-f-]{36}$/);
      const eventUrl = page.url();
      eventId = eventUrl.split('/').pop() ?? '';

      // 2. Uređivač: izmena naslova se vidi u pregledu i sama sačuva.
      await page.goto(`${eventUrl}/editor`);
      const title = page.getByLabel('Naslov', { exact: true }).first();
      await title.fill('Ana i Marko se venčavaju');
      await expect(page.getByText('Sačuvano')).toBeVisible({ timeout: 15_000 });

      // 3. Bez plaćenog paketa objavljivanje ne radi.
      await page.goto(`${eventUrl}/objavljivanje`);
      await expect(
        page.getByRole('button', { name: 'Objavi pozivnicu' }),
      ).toBeDisabled();

      // 4. Naplata: narudžbina za tu pozivnicu, pa potvrda administratora.
      await page.goto(`${eventUrl}/naplata`);
      await page.getByRole('radio', { name: /Premium/ }).check();
      await page.getByRole('button', { name: 'Nastavi na plaćanje' }).click();
      await expect(page).toHaveURL(/naplata=povratak/);
      await expect(page.getByText('Čeka uplatu')).toBeVisible();

      const admin = await createSignedInUser({ role: 'admin' });
      const adminContext = await browser.newContext();

      try {
        await signIn(adminContext, admin, url);
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/admin/narudzbine?status=pending');
        await adminPage.getByRole('button', { name: 'Aktiviraj ručno' }).first().click();
        await adminPage.getByLabel('Razlog').fill('E2E scenario.');
        await adminPage.getByRole('button', { name: 'Aktiviraj ručno' }).last().click();
        await expect(adminPage.getByText('Narudžbina je aktivirana.')).toBeVisible();
        await adminPage.close();
      } finally {
        await adminContext.close();
        await deleteUser(admin.id);
      }

      // 5. Objavljivanje sada radi i javni link je aktivan.
      await page.goto(`${eventUrl}/objavljivanje`);
      const publish = page.getByRole('button', { name: 'Objavi pozivnicu' });
      await expect(publish).toBeEnabled();
      await publish.click();
      await expect(page.getByText('Pozivnica je objavljena.')).toBeVisible();

      const [invitation] = await sql<{ public_slug: string; id: string }[]>`
        select id, public_slug from invitations where event_id = ${eventId} limit 1
      `;
      const slug = invitation?.public_slug ?? '';
      expect(slug).not.toBe('');

      // Šablon „Editorial minimal” već nosi RSVP sekciju, pa gost dobija formu
      // bez ijedne dodatne izmene - upravo to i treba da bude slučaj.
      const [rsvpSection] = await sql<{ count: string }[]>`
        select count(*)::text as count from invitation_sections
        where invitation_id = ${invitation?.id ?? null} and type = 'rsvp'
      `;
      expect(rsvpSection?.count).toBe('1');

      // 6. Spisak gostiju: organizator unosi gosta.
      await page.goto(`${eventUrl}/gosti`);
      await page.getByRole('button', { name: 'Dodaj gosta' }).click();
      await page.getByLabel('Ime', { exact: true }).fill('Nenad');
      await page.getByLabel('Prezime').fill('Ilić');
      await page.getByRole('button', { name: 'Sačuvaj' }).click();
      await expect(
        page
          .getByRole('row')
          .filter({ hasText: 'Nenad Ilić' })
          .or(page.getByRole('listitem').filter({ hasText: 'Nenad Ilić' })),
      ).toBeVisible();

      // 7. Gost otvara javni link i potvrđuje dolazak - bez naloga.
      const guestContext = await browser.newContext();

      try {
        const guestPage = await guestContext.newPage();
        await guestPage.goto(`${url}/p/${slug}`);

        await guestPage.getByLabel('Ime i prezime').fill('Nenad Ilić');
        await guestPage.getByRole('radio', { name: 'Dolazim', exact: true }).check();
        await guestPage.getByLabel('Broj odraslih').fill('2');
        await guestPage.getByLabel('Poruka domaćinima').fill('Radujemo se!');

        // Obrazac odbija slanje brže od dve sekunde - odbrana od automata.
        await guestPage.waitForTimeout(2500);
        await guestPage.getByRole('button', { name: 'Pošalji odgovor' }).click();

        // Potvrdni tekst dolazi iz šablona, pa se proverava poruka aplikacije.
        await expect(guestPage.getByText('Vaš dolazak je zabeležen.')).toBeVisible();
        await guestPage.close();
      } finally {
        await guestContext.close();
      }

      // 8. Organizator vidi odgovor.
      await page.goto(`${eventUrl}/odgovori`);
      await expect(page.getByText('Nenad Ilić').first()).toBeVisible();

      // 9. Raspored sedenja: sto i gost na mestu, bez miša.
      await page.goto(`${eventUrl}/raspored`);
      await page.getByRole('button', { name: 'Dodaj sto' }).click();

      await page
        .getByLabel('Rasporedi: Nenad Ilić')
        .selectOption({ label: 'Sto 1' });

      // 10. Izvoz rasporeda vraća CSV, a ne HTML stranicu.
      const download = await page.request.get(`${eventUrl}/raspored/izvoz`);
      expect(download.status()).toBe(200);
      expect(download.headers()['content-type']).toContain('text/csv');

      // Sve što je scenario napravio postoji i u bazi, ne samo na ekranu.
      const [summary] = await sql<{ guests: string; responses: string; seated: string }[]>`
        select
          (select count(*)::text from guests g where g.event_id = ${eventId}) as guests,
          (select count(*)::text from rsvp_responses r
             join invitations i on r.invitation_id = i.id
             where i.event_id = ${eventId}) as responses,
          (select count(*)::text from seat_assignments sa
             join tables t on sa.table_id = t.id
             join rooms ro on t.room_id = ro.id
             join seating_plan_versions v on ro.version_id = v.id
             join seating_plans p on v.plan_id = p.id
             where p.event_id = ${eventId}) as seated
      `;

      expect(summary?.guests).toBe('1');
      expect(summary?.responses).toBe('1');
      expect(summary?.seated).toBe('1');
    } finally {
      if (eventId) await sql`delete from events where id = ${eventId}`;
      await sql`
        update feature_plans
        set features = jsonb_set(features, '{limits,maxGuests}', '0'::jsonb)
        where code = 'free'
      `;
    }
  });
});
