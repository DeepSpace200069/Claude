import { randomBytes, randomUUID } from 'node:crypto';

import { test as base, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';

/**
 * E2E pomoćni alati.
 *
 * Prijava magic linkom zahteva čitanje mejla, što E2E test ne treba da simulira
 * kroz interfejs pri svakom scenariju. Umesto toga upisujemo sesiju direktno u
 * bazu - isto što bi Auth.js uradio posle klika na link - i postavljamo kolačić.
 * Sam tok prijave se testira zasebno, kroz stranicu `/login`.
 */
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://pozivnica:pozivnica@localhost:5432/pozivnica';

/**
 * Direktan pristup bazi iz testova.
 *
 * Koristi se za ono što interfejs ne izlaže: sesija umesto magic linka i
 * čitanje referenci koje inače postoje samo kod provajdera naplate.
 */
export const sql = postgres(connectionString, { max: 2 });

export type TestUser = {
  id: string;
  email: string;
  sessionToken: string;
};

export async function createSignedInUser(
  options: { role?: 'user' | 'admin' } = {},
): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@primer.rs`;
  const sessionToken = randomBytes(32).toString('hex');
  const role = options.role ?? 'user';

  const [user] = await sql<{ id: string }[]>`
    insert into users (email, name, email_verified, role, locale)
    values (${email}, 'E2E Korisnik', now(), ${role}, 'sr-Latn')
    returning id
  `;

  if (!user) throw new Error('E2E korisnik nije napravljen.');

  await sql`
    insert into sessions (session_token, user_id, expires)
    values (${sessionToken}, ${user.id}, now() + interval '1 day')
  `;

  return { id: user.id, email, sessionToken };
}

/**
 * Uklanjanje test korisnika.
 *
 * Narudžbine se brišu prvo: `orders.user_id` ima `on delete restrict`, jer
 * finansijski trag ne sme da nestane zato što je neko obrisao nalog. Brisanje
 * naloga u proizvodu (Faza 8) mora da reši isto pitanje - ovde je dovoljno da
 * test za sobom počisti i narudžbine.
 */
export async function deleteUser(userId: string): Promise<void> {
  await sql`delete from orders where user_id = ${userId}`;
  await sql`delete from users where id = ${userId}`;
}

/** Postavlja Auth.js kolačić sesije za dati kontekst pregledača. */
export async function signIn(
  context: BrowserContext,
  user: TestUser,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL);

  await context.addCookies([
    {
      // Bez HTTPS-a Auth.js koristi ime bez `__Secure-` prefiksa.
      name: 'authjs.session-token',
      value: user.sessionToken,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 86_400,
    },
  ]);
}

/**
 * Test sa već prijavljenim korisnikom.
 * Korisnik se briše posle testa, pa se podaci ne gomilaju u bazi.
 */
export const test = base.extend<{ signedInPage: Page; testUser: TestUser }>({
  testUser: async ({}, use) => {
    const user = await createSignedInUser();
    await use(user);
    await deleteUser(user.id);
  },

  signedInPage: async ({ context, page, baseURL, testUser }, use) => {
    await signIn(context, testUser, baseURL ?? 'http://localhost:3000');
    await use(page);
  },
});

export { expect } from '@playwright/test';
