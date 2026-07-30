import postgres from 'postgres';

import { expect, test } from './fixtures';

/**
 * Gosti i potvrda dolaska od kraja do kraja (zahtev 38, koraci 10–12).
 *
 * Dva scenarija, iz dva ugla: organizator koji vodi spisak i gost koji otvara
 * lični link i odgovara. Gost nema nalog, pa je njegov put ujedno i provera da
 * javna forma zaista radi bez prijave.
 */
const sql = postgres(
  process.env.DATABASE_URL ?? 'postgresql://pozivnica:pozivnica@localhost:5432/pozivnica',
  { max: 2 },
);

test.afterAll(async () => {
  await sql.end();
});

/**
 * Pravi objavljenu pozivnicu sa RSVP sekcijom.
 *
 * Stanje se postavlja direktno u bazi iz istog razloga kao u testu javne
 * pozivnice: tok „napravi nacrt pa objavi" ide kroz naplatu, koja je Faza 7.
 * Ovde nas zanima šta gost može da uradi kada je pozivnica već objavljena.
 */
async function createInvitationWithRsvp(options: {
  ownerId: string;
  slug: string;
  guestLimit?: number | null;
}): Promise<{ eventId: string; invitationId: string }> {
  const [type] = await sql<{ id: string }[]>`
    select id from event_types where key = 'wedding' limit 1
  `;

  // Besplatan paket namerno ne uključuje spisak gostiju, pa test podiže granicu
  // isto kao što bi je podigla kupovina paketa.
  await sql`
    update feature_plans
    set features = jsonb_set(features, '{limits,maxGuests}',
        ${JSON.stringify(options.guestLimit ?? 200)}::jsonb)
    where code = 'free'
  `;

  const [event] = await sql<{ id: string }[]>`
    insert into events (owner_id, event_type_id, name, details, starts_at, time_zone, city, venue_name, primary_locale)
    values (${options.ownerId}, ${type!.id}, 'E2E gosti', '{}'::jsonb,
            now() + interval '150 days', 'Europe/Belgrade', 'Novi Sad', 'Salaš 137', 'sr-Latn')
    returning id
  `;

  const [theme] = await sql<{ theme_tokens: unknown }[]>`
    select tv.theme_tokens from templates t
    join template_versions tv on t.published_version_id = tv.id
    limit 1
  `;

  const [invitation] = await sql<{ id: string }[]>`
    insert into invitations (event_id, public_slug, title, theme_tokens, status, privacy, published_at)
    values (${event!.id}, ${options.slug}, 'Ana i Marko',
            ${JSON.stringify(theme!.theme_tokens)}::jsonb, 'published', 'unlisted', now())
    returning id
  `;

  await sql`
    insert into invitation_sections (invitation_id, type, schema_version, position, is_visible, data)
    values
      (${invitation!.id}, 'hero', 1, 0, true, ${JSON.stringify({
        eyebrow: 'Pozivamo vas',
        title: 'Ana i Marko',
        subtitle: 'Venčavamo se',
        image: null,
        layout: 'centered',
        overlayOpacity: 25,
        showIntroAnimation: false,
      })}::jsonb),
      (${invitation!.id}, 'rsvp', 1, 1, true, ${JSON.stringify({
        title: 'Potvrda dolaska',
        intro: 'Javite nam da li dolazite.',
        deadline: null,
        deadlineNote: '',
        askChildren: true,
        askCompanionNames: false,
        askMessage: true,
        askContact: false,
        allowMaybe: true,
        confirmationMessage: 'Vidimo se!',
      })}::jsonb)
  `;

  return { eventId: event!.id, invitationId: invitation!.id };
}

async function cleanUp(eventId: string): Promise<void> {
  await sql`delete from events where id = ${eventId}`;
  await sql`
    update feature_plans
    set features = jsonb_set(features, '{limits,maxGuests}', '0'::jsonb)
    where code = 'free'
  `;
}

test.describe('organizator vodi spisak gostiju', () => {
  test('dodaje gosta, izdaje lični link i filtrira spisak', async ({
    signedInPage: page,
    testUser,
  }) => {
    const slug = `e2e-gosti-${Date.now()}`;
    const { eventId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/gosti`);

      await expect(page.getByRole('heading', { name: 'Gosti', exact: true })).toBeVisible();
      await expect(page.getByText('Spisak gostiju je prazan')).toBeVisible();

      await page.getByRole('button', { name: 'Dodaj gosta' }).click();

      await page.getByLabel('Ime', { exact: true }).fill('Nenad');
      await page.getByLabel('Prezime').fill('Ilić');
      await page.getByLabel('Oznake').fill('kumovi, porodica');
      await page.getByRole('button', { name: 'Sačuvaj' }).click();

      // Oznake se vide uz gosta u redu tabele, a ne samo u filteru.
      const row = page.getByRole('row').filter({ hasText: 'Nenad Ilić' });
      await expect(row).toBeVisible();
      await expect(row.getByText('kumovi')).toBeVisible();
      await expect(row.getByText('porodica')).toBeVisible();

      // Lični link se prikazuje samo jednom i to piše u dijalogu.
      await page.getByRole('button', { name: 'Napravi lični link' }).first().click();

      const linkField = page.getByRole('textbox', { name: 'Lični link' });
      await expect(linkField).toHaveValue(new RegExp(`/p/${slug}/[0-9A-Z]{20,}$`));
      await expect(
        page.getByText('Link prikazujemo samo sada', { exact: false }),
      ).toBeVisible();

      // Zatvaranje tastaturom: isti put kojim ga zatvara i korisnik na telefonu.
      await page.keyboard.press('Escape');
      await expect(linkField).toHaveCount(0);

      // Filtriranje ide kroz URL, pa mora da radi i posle osvežavanja.
      await page.goto(`/app/dogadjaji/${eventId}/gosti?pretraga=Nenad`);
      await expect(page.getByRole('cell', { name: /Nenad Ilić/ })).toBeVisible();

      await page.goto(`/app/dogadjaji/${eventId}/gosti?pretraga=NePostoji`);
      await expect(page.getByRole('cell', { name: /Nenad Ilić/ })).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('izvoz vraća CSV, a ne HTML stranicu', async ({ signedInPage: page, testUser }) => {
    const slug = `e2e-izvoz-${Date.now()}`;
    const { eventId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      const response = await page.request.get(
        `/app/dogadjaji/${eventId}/gosti/izvoz`,
      );

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/csv');
      // Privatni podaci ne smeju da završe ni u jednom kešu.
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(await response.text()).toContain('Ime');
    } finally {
      await cleanUp(eventId);
    }
  });

  test('tuđi spisak gostiju nije dostupan', async ({ signedInPage: page }) => {
    await page.goto('/app/dogadjaji/11111111-2222-4333-8444-555555555555/gosti');
    await expect(page.getByText(/Stranica nije pronađena|Nemate pristup/)).toBeVisible();
  });
});

test.describe('gost potvrđuje dolazak', () => {
  test('šalje odgovor sa javne pozivnice i dobija link za izmenu', async ({
    page,
    testUser,
  }) => {
    const slug = `e2e-rsvp-${Date.now()}`;
    const { eventId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();

      await page.getByLabel('Ime i prezime').fill('Nenad Ilić');
      await page.getByRole('radio', { name: 'Dolazim', exact: true }).check();
      await page.getByLabel('Broj odraslih').fill('2');
      await page.getByLabel('Broj dece').fill('1');
      await page.getByLabel('Poruka domaćinima').fill('Radujemo se!');

      /*
       * Obrazac nosi potpisani ključ sa vremenom izdavanja i odbija slanje brže
       * od dve sekunde. To je odbrana od automata, pa test čeka isto koliko bi
       * čekao i čovek koji kuca.
       */
      await page.waitForTimeout(2500);

      await page.getByRole('button', { name: 'Pošalji odgovor' }).click();

      await expect(page.getByText('Vaš dolazak je zabeležen.')).toBeVisible();
      await expect(page.getByText('Vidimo se!')).toBeVisible();

      const editField = page.getByRole('textbox', { name: 'Izmeni odgovor' });
      await expect(editField).toHaveValue(new RegExp(`/p/${slug}/odgovor/[0-9A-Z]{20,}$`));

      // Odgovor je stvarno upisan - proveravamo u bazi, ne samo u interfejsu.
      const rows = await sql<{ full_name: string; adults_count: number; message: string }[]>`
        select r.full_name, r.adults_count, r.message
        from rsvp_responses r
        join invitations i on r.invitation_id = i.id
        where i.public_slug = ${slug}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.full_name).toBe('Nenad Ilić');
      expect(rows[0]?.adults_count).toBe(2);
      expect(rows[0]?.message).toBe('Radujemo se!');
    } finally {
      await cleanUp(eventId);
    }
  });

  test('link za izmenu otvara popunjenu formu', async ({ page, testUser }) => {
    const slug = `e2e-izmena-${Date.now()}`;
    const { eventId, invitationId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      // Odgovor se pravi direktno u bazi da bi test merio samo izmenu.
      const { createHash, randomBytes } = await import('node:crypto');
      const token = randomBytes(16).toString('hex').toUpperCase();
      const tokenHash = createHash('sha256').update(token).digest('hex');

      await sql`
        insert into rsvp_responses
          (invitation_id, full_name, status, adults_count, children_count, message, edit_token_hash)
        values (${invitationId}, 'Ana Popović', 'yes', 2, 0, 'Prva poruka', ${tokenHash})
      `;

      await page.goto(`/p/${slug}/odgovor/${token}`);

      await expect(page.getByLabel('Ime i prezime')).toHaveValue('Ana Popović');
      await expect(page.getByLabel('Broj odraslih')).toHaveValue('2');
      await expect(page.getByRole('radio', { name: 'Dolazim', exact: true })).toBeChecked();

      await page.getByLabel('Broj odraslih').fill('3');
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Sačuvaj izmenu' }).click();

      await expect(page.getByText('Vaš odgovor je izmenjen.')).toBeVisible();

      // Izmena menja postojeći odgovor umesto da napravi drugi.
      const rows = await sql<{ adults_count: number }[]>`
        select adults_count from rsvp_responses where invitation_id = ${invitationId}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.adults_count).toBe(3);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('lični link sa velikim slovima ostaje ispravan i pozdravlja gosta', async ({
    page,
    testUser,
  }) => {
    const slug = `e2e-licni-link-${Date.now()}`;
    const { eventId, invitationId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      /*
       * Tokeni koriste abecedu sa velikim slovima. Kanonizacija javne putanje
       * sme da spusti na mala slova **samo slug** - da je dirala i token, svaki
       * već poslati lični link bi tiho prestao da radi.
       */
      const { createHash, randomBytes } = await import('node:crypto');
      const token = randomBytes(16).toString('hex').toUpperCase();

      // Baza traži da primalac bude vezan za gosta ili domaćinstvo (CHECK).
      const [household] = await sql<{ id: string }[]>`
        insert into guest_households (event_id, name, max_guests)
        values (${eventId}, 'Porodica Ilić', 4)
        returning id
      `;

      await sql`
        insert into invitation_recipients
          (invitation_id, household_id, token_hash, greeting_name, max_guests)
        values (${invitationId}, ${household!.id},
                ${createHash('sha256').update(token).digest('hex')}, 'Porodica Ilić', 4)
      `;

      const response = await page.goto(`/p/${slug}/${token}`);

      expect(response?.status()).toBe(200);
      expect(page.url()).toContain(token);

      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();
      // Forma zna za koga je link izdat i koliko osoba prima.
      await expect(page.getByLabel('Ime i prezime')).toHaveValue('Porodica Ilić');
      await expect(page.getByText('Ovaj link važi za najviše 4 osoba.')).toBeVisible();
    } finally {
      await cleanUp(eventId);
    }
  });

  test('nevažeći link za izmenu daje objašnjenje, ne grešku', async ({
    page,
    testUser,
  }) => {
    const slug = `e2e-lose-${Date.now()}`;
    const { eventId } = await createInvitationWithRsvp({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/p/${slug}/odgovor/OVAJTOKENNEPOSTOJI123456`);

      await expect(
        page.getByRole('heading', { name: 'Link za izmenu ne važi' }),
      ).toBeVisible();
      await expect(page.locator('.invitation-root')).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });
});
