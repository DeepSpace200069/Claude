import postgres from 'postgres';

import { expect, test } from './fixtures';

/**
 * Javna pozivnica od kraja do kraja (zahtev 38, koraci 7–9).
 *
 * Scenario prati gosta, ne organizatora: on ne zna šta je „nacrt" ni „paket" -
 * otvori link i ili vidi pozivnicu ili dobije jasnu poruku zašto je ne vidi.
 */
const sql = postgres(
  process.env.DATABASE_URL ?? 'postgresql://pozivnica:pozivnica@localhost:5432/pozivnica',
  { max: 2 },
);

test.afterAll(async () => {
  await sql.end();
});

/**
 * Pravi objavljenu pozivnicu direktno u bazi.
 *
 * Tok „napravi nacrt pa objavi" ide kroz paket koji uključuje objavljivanje, a
 * to je stvar naplate (Faza 7). Ovde nas zanima šta gost vidi, pa se stanje
 * postavlja direktno - isto kao što E2E prijava upisuje sesiju umesto da čita
 * mejl.
 */
async function createPublishedInvitation(options: {
  ownerId: string;
  slug: string;
  privacy?: 'public' | 'unlisted' | 'pin' | 'invite_only';
  pinHash?: string | null;
  expiresAt?: string | null;
  status?: 'draft' | 'published' | 'unpublished';
  title?: string;
}): Promise<{ eventId: string; invitationId: string }> {
  const [type] = await sql<{ id: string }[]>`
    select id from event_types where key = 'wedding' limit 1
  `;

  const [event] = await sql<{ id: string }[]>`
    insert into events (owner_id, event_type_id, name, details, starts_at, time_zone, city, venue_name, primary_locale)
    values (${options.ownerId}, ${type!.id}, 'E2E javna pozivnica', '{}'::jsonb,
            now() + interval '120 days', 'Europe/Belgrade', 'Beograd', 'Restoran Kej', 'sr-Latn')
    returning id
  `;

  const [theme] = await sql<{ theme_tokens: unknown }[]>`
    select tv.theme_tokens from templates t
    join template_versions tv on t.published_version_id = tv.id
    limit 1
  `;

  const [invitation] = await sql<{ id: string }[]>`
    insert into invitations (event_id, public_slug, title, theme_tokens, status, privacy, pin_hash, expires_at, published_at)
    values (${event!.id}, ${options.slug}, ${options.title ?? 'Ana i Marko'},
            ${JSON.stringify(theme!.theme_tokens)}::jsonb,
            ${options.status ?? 'published'}, ${options.privacy ?? 'unlisted'},
            ${options.pinHash ?? null}, ${options.expiresAt ?? null}, now())
    returning id
  `;

  await sql`
    insert into invitation_sections (invitation_id, type, schema_version, position, is_visible, data)
    values (${invitation!.id}, 'hero', 1, 0, true,
            ${JSON.stringify({
              eyebrow: 'Pozivamo vas',
              title: options.title ?? 'Ana i Marko',
              subtitle: 'Venčavamo se',
              image: null,
              layout: 'centered',
              overlayOpacity: 25,
              showIntroAnimation: false,
            })}::jsonb)
  `;

  return { eventId: event!.id, invitationId: invitation!.id };
}

async function cleanUp(eventId: string): Promise<void> {
  await sql`delete from events where id = ${eventId}`;
}

/** SHA-256 heš PIN-a, isti oblik koji aplikacija upisuje. */
async function pinHash(pin: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(pin).digest('hex');
}

test.describe('gost otvara pozivnicu', () => {
  test('objavljena pozivnica se prikazuje i nije indeksirana bez dozvole', async ({
    page,
    testUser,
  }) => {
    const slug = `e2e-otvorena-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();
      await expect(page.locator('.invitation-root')).toBeVisible();

      // Podrazumevani režim je „samo sa linkom" - pretraživač ne sme da je uzme.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/,
      );
    } finally {
      await cleanUp(eventId);
    }
  });

  test('režim „javno" dozvoljava indeksiranje', async ({ page, testUser }) => {
    const slug = `e2e-javna-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      privacy: 'public',
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();

      // Ovo je razlika koju korisnik bira u interfejsu; ako je zaglavlje ili
      // meta oznaka pregaze, opcija „javno" postaje prazno obećanje.
      const robots = page.locator('meta[name="robots"]');
      if (await robots.count()) {
        await expect(robots).toHaveAttribute('content', /(?<!no)index/);
      }
    } finally {
      await cleanUp(eventId);
    }
  });

  test('nacrt gost ne vidi', async ({ page, testUser }) => {
    const slug = `e2e-nacrt-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      status: 'draft',
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(
        page.getByRole('heading', { name: 'Pozivnica trenutno nije aktivna' }),
      ).toBeVisible();
      // Nijedan deo sadržaja ne sme da procuri.
      await expect(page.locator('.invitation-root')).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('istekla pozivnica kaže do kada je važila', async ({ page, testUser }) => {
    const slug = `e2e-istekla-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      expiresAt: '2020-01-01T22:59:59Z',
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(
        page.getByRole('heading', { name: 'Pozivnica više nije dostupna' }),
      ).toBeVisible();
      await expect(page.locator('.invitation-root')).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('nepostojeći link daje objašnjenje, ne grešku', async ({ page }) => {
    await page.goto('/p/ovaj-slug-ne-postoji-nigde');

    await expect(
      page.getByRole('heading', { name: 'Pozivnica nije pronađena' }),
    ).toBeVisible();
  });

  test('PIN štiti sadržaj i pušta ga tek posle tačnog unosa', async ({
    page,
    testUser,
  }) => {
    const slug = `e2e-pin-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      privacy: 'pin',
      pinHash: await pinHash('4271'),
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(
        page.getByRole('heading', { name: 'Pozivnica je zaštićena' }),
      ).toBeVisible();
      await expect(page.locator('.invitation-root')).toHaveCount(0);

      // Pogrešan PIN ne otvara ništa i to kaže.
      await page.getByLabel('PIN').fill('0000');
      await page.getByRole('button', { name: 'Otvori pozivnicu' }).click();
      await expect(page.getByText('PIN nije tačan')).toBeVisible();

      await page.getByLabel('PIN').fill('4271');
      await page.getByRole('button', { name: 'Otvori pozivnicu' }).click();

      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();

      // Posle otključavanja gost ne unosi PIN ponovo pri svakoj poseti.
      await page.goto(`/p/${slug}`);
      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();
    } finally {
      await cleanUp(eventId);
    }
  });

  test('režim ličnih linkova traži token', async ({ page, testUser }) => {
    const slug = `e2e-licni-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      privacy: 'invite_only',
    });

    try {
      await page.goto(`/p/${slug}`);

      await expect(
        page.getByRole('heading', { name: 'Potreban je vaš lični link' }),
      ).toBeVisible();
      await expect(page.locator('.invitation-root')).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });
});

test.describe('organizator deli pozivnicu', () => {
  test('nacrt nema šta da podeli i to jasno kaže', async ({
    signedInPage: page,
    testUser,
  }) => {
    const slug = `e2e-deljenje-nacrt-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
      status: 'draft',
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/objavljivanje`);

      await expect(page.getByText('Link još nije aktivan')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'QR kod' })).toHaveCount(0);
    } finally {
      await cleanUp(eventId);
    }
  });

  test('objavljena pozivnica nudi link, QR kod i kanale za deljenje', async ({
    signedInPage: page,
    testUser,
  }) => {
    const slug = `e2e-deljenje-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/app/dogadjaji/${eventId}/objavljivanje`);

      await expect(page.getByLabel('Javni link')).toHaveValue(new RegExp(`/p/${slug}$`));
      await expect(page.getByRole('img', { name: /QR kod/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Viber' })).toBeVisible();

      // Preuzimanje QR koda mora zaista da vrati sliku, ne HTML stranicu.
      const svg = await page.request.get(`/app/dogadjaji/${eventId}/qr?format=svg`);
      expect(svg.status()).toBe(200);
      expect(svg.headers()['content-type']).toContain('image/svg+xml');

      const png = await page.request.get(`/app/dogadjaji/${eventId}/qr?format=png`);
      expect(png.status()).toBe(200);
      expect(png.headers()['content-type']).toContain('image/png');
      expect((await png.body()).subarray(1, 4).toString('ascii')).toBe('PNG');
    } finally {
      await cleanUp(eventId);
    }
  });

  test('promena privatnosti na PIN odmah važi za gosta', async ({
    signedInPage: page,
    testUser,
  }) => {
    const slug = `e2e-privatnost-${Date.now()}`;
    const { eventId } = await createPublishedInvitation({
      ownerId: testUser.id,
      slug,
    });

    try {
      await page.goto(`/p/${slug}`);
      await expect(page.getByRole('heading', { name: 'Ana i Marko' })).toBeVisible();

      await page.goto(`/app/dogadjaji/${eventId}/objavljivanje`);
      await page.getByText('Zaštićena PIN-om').click();
      await page.getByLabel('PIN za goste').fill('9182');
      await page.getByRole('button', { name: 'Sačuvaj' }).click();
      await expect(page.getByText('Podešavanja su sačuvana.')).toBeVisible();

      // Keš javne stranice mora da se poništi odmah posle izmene (zahtev 4.7).
      await page.goto(`/p/${slug}`);
      await expect(
        page.getByRole('heading', { name: 'Pozivnica je zaštićena' }),
      ).toBeVisible();
    } finally {
      await cleanUp(eventId);
    }
  });

  test('tuđa stranica objavljivanja nije dostupna', async ({ signedInPage: page }) => {
    await page.goto(
      '/app/dogadjaji/11111111-2222-4333-8444-555555555555/objavljivanje',
    );
    await expect(page.getByText(/Stranica nije pronađena|Nemate pristup/)).toBeVisible();
  });
});
