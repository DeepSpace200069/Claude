import postgres from 'postgres';

import { expect, test } from './fixtures';

/**
 * Raspored sedenja od kraja do kraja (zahtev 38, korak 11).
 *
 * Scenario prati ono što organizator zaista radi: doda sto, posadi goste bez
 * miša, vidi upozorenje kada pravilo bude prekršeno, zaključa raspored i
 * preuzme spisak. Prevlačenje mišem je pokriveno jedinicama i integracionim
 * testovima; ovde se proverava da **alternativa bez miša radi jednako dobro**,
 * jer je ona jedina koja radi svima (zahtev 31).
 */
const sql = postgres(
  process.env.DATABASE_URL ?? 'postgresql://pozivnica:pozivnica@localhost:5432/pozivnica',
  { max: 2 },
);

test.afterAll(async () => {
  await sql.end();
});

async function createEventWithGuests(options: {
  ownerId: string;
  guests: ReadonlyArray<[string, string]>;
}): Promise<{ eventId: string }> {
  const [type] = await sql<{ id: string }[]>`
    select id from event_types where key = 'wedding' limit 1
  `;

  // Raspored sedenja je mogućnost paketa; test je uključuje isto kao kupovina.
  await sql`
    update feature_plans
    set features = jsonb_set(
      jsonb_set(features, '{flags,seating}', 'true'::jsonb),
      '{limits,maxGuests}', '200'::jsonb)
    where code = 'free'
  `;

  const [event] = await sql<{ id: string }[]>`
    insert into events (owner_id, event_type_id, name, details, starts_at, time_zone, city, venue_name, primary_locale)
    values (${options.ownerId}, ${type!.id}, 'E2E raspored', '{}'::jsonb,
            now() + interval '90 days', 'Europe/Belgrade', 'Novi Sad', 'Salaš 137', 'sr-Latn')
    returning id
  `;

  for (const [firstName, lastName] of options.guests) {
    await sql`
      insert into guests (event_id, first_name, last_name)
      values (${event!.id}, ${firstName}, ${lastName})
    `;
  }

  return { eventId: event!.id };
}

async function cleanUp(eventId: string): Promise<void> {
  await sql`delete from events where id = ${eventId}`;
  await sql`
    update feature_plans
    set features = jsonb_set(
      jsonb_set(features, '{flags,seating}', 'false'::jsonb),
      '{limits,maxGuests}', '0'::jsonb)
    where code = 'free'
  `;
}

test.describe('organizator pravi raspored sedenja', () => {
  test('dodaje sto i sedi goste bez miša', async ({ signedInPage: page, testUser }) => {
    const { eventId } = await createEventWithGuests({
      ownerId: testUser.id,
      guests: [
        ['Nenad', 'Ilić'],
        ['Sanja', 'Ilić'],
      ],
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/raspored`);

      await expect(
        page.getByRole('heading', { name: 'Raspored sedenja', exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Neraspoređeni (2)')).toBeVisible();

      await page.getByRole('button', { name: 'Dodaj sto' }).click();
      await expect(page.getByRole('button', { name: 'Sto 1', exact: true })).toBeVisible();

      // Pristupačna alternativa prevlačenju: lista stolova uz ime gosta.
      await page
        .getByLabel('Rasporedi: Nenad Ilić')
        .selectOption({ label: 'Sto 1' });

      await expect(page.getByText('Neraspoređeni (1)')).toBeVisible();
      await expect(page.getByText('1 od 8')).toBeVisible();

      await page.getByLabel('Rasporedi: Sanja Ilić').selectOption({ label: 'Sto 1' });
      await expect(page.getByText('Neraspoređeni (0)')).toBeVisible();
      await expect(page.getByText('Svi gosti su raspoređeni.')).toBeVisible();

      // Raspored je stvarno upisan, ne samo prikazan.
      const rows = await sql<{ count: number }[]>`
        select count(*)::int as count
        from seat_assignments a
        join tables t on a.table_id = t.id
        join rooms r on t.room_id = r.id
        join seating_plan_versions v on r.version_id = v.id
        join seating_plans p on v.plan_id = p.id
        where p.event_id = ${eventId}
      `;
      expect(rows[0]?.count).toBe(2);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('kapacitet zaustavlja gosta viška i kaže zašto', async ({
    signedInPage: page,
    testUser,
  }) => {
    const { eventId } = await createEventWithGuests({
      ownerId: testUser.id,
      guests: [
        ['Ana', 'Popović'],
        ['Bojan', 'Đurić'],
      ],
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/raspored`);
      await page.getByRole('button', { name: 'Dodaj sto' }).click();

      // Sto se smanjuje na jedno mesto kroz inspektor.
      await page.getByRole('button', { name: 'Sto 1', exact: true }).click();
      await page.getByLabel('Broj mesta').fill('1');
      await page.getByRole('button', { name: 'Sačuvaj' }).click();
      await expect(page.getByText('Sačuvano.')).toBeVisible();

      await page.getByLabel('Rasporedi: Ana Popović').selectOption({ label: 'Sto 1' });
      await expect(page.getByText('1 od 1')).toBeVisible();

      // Pun sto je u listi, ali onemogućen - vidi se da postoji i zašto ne ide.
      const select = page.getByLabel('Rasporedi: Bojan Đurić');
      await expect(select.locator('option[value]:not([value=""])').first()).toBeDisabled();
    } finally {
      await cleanUp(eventId);
    }
  });

  test('zaključana verzija ne prima izmene', async ({
    signedInPage: page,
    testUser,
  }) => {
    const { eventId } = await createEventWithGuests({
      ownerId: testUser.id,
      guests: [['Marko', 'Stanković']],
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/raspored`);
      await page.getByRole('button', { name: 'Dodaj sto' }).click();
      await expect(page.getByRole('button', { name: 'Sto 1', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Zaključaj' }).click();

      await expect(
        page.getByText('Verzija je zaključana i ne prima izmene.', { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dodaj sto' })).toBeDisabled();
      await expect(page.getByLabel('Rasporedi: Marko Stanković')).toBeDisabled();
    } finally {
      await cleanUp(eventId);
    }
  });

  test('izvoz vraća CSV, a prikaz za štampu plan sale', async ({
    signedInPage: page,
    testUser,
  }) => {
    const { eventId } = await createEventWithGuests({
      ownerId: testUser.id,
      guests: [['Nenad', 'Ilić']],
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/raspored`);
      await page.getByRole('button', { name: 'Dodaj sto' }).click();
      await page.getByLabel('Rasporedi: Nenad Ilić').selectOption({ label: 'Sto 1' });
      await expect(page.getByText('1 od 8')).toBeVisible();

      const csv = await page.request.get(`/app/dogadjaji/${eventId}/raspored/izvoz`);
      expect(csv.status()).toBe(200);
      expect(csv.headers()['content-type']).toContain('text/csv');
      expect(csv.headers()['cache-control']).toContain('no-store');

      const text = await csv.text();
      expect(text).toContain('Sto 1');
      expect(text).toContain('Nenad Ilić');

      await page.goto(`/app/dogadjaji/${eventId}/raspored/stampa`);
      await expect(
        page.getByRole('heading', { name: /Raspored sedenja/ }),
      ).toBeVisible();
      await expect(page.getByRole('img', { name: 'Sala' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Sto 1/ })).toBeVisible();
      // Stranica za štampu se nikad ne indeksira.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/,
      );
    } finally {
      await cleanUp(eventId);
    }
  });

  test('tuđi raspored nije dostupan', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/11111111-2222-4333-8444-555555555555/raspored');
    await expect(page.getByText(/Stranica nije pronađena|Nemate pristup/)).toBeVisible();
  });
});
