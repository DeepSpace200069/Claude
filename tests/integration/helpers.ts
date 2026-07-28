import { eq, sql } from 'drizzle-orm';

import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { DEFAULT_DETAIL_FIELDS } from '@/features/events/details';
import { db } from '@/server/db';
import { eventTypes, featurePlans, users } from '@/server/db/schema';

/** Da li integracioni testovi uopšte mogu da se izvrše. */
export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Prazni sve tabele između paketa testova. */
export async function truncateAll(): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(sql`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not like '__drizzle%'
  `);

  const names = rows.map((row) => `"public"."${row.tablename}"`);
  if (names.length === 0) return;

  await db.execute(
    sql.raw(`truncate table ${names.join(', ')} restart identity cascade`),
  );
}

/** Minimalni katalog koji svaki test očekuje: tipovi događaja i paketi. */
export async function seedCatalog(): Promise<{ weddingTypeId: string }> {
  await db.insert(featurePlans).values(
    Object.entries(DEFAULT_PLANS).map(([code, features], index) => ({
      code,
      name: code,
      priceMinor: index * 100000,
      currency: 'RSD',
      features,
      sortOrder: (index + 1) * 10,
      isDefault: code === 'free',
    })),
  );

  const [wedding] = await db
    .insert(eventTypes)
    .values({
      key: 'wedding',
      slug: 'vencanje',
      labelKey: 'eventTypes.wedding',
      icon: 'rings',
      sortOrder: 10,
      detailFields: DEFAULT_DETAIL_FIELDS.wedding ?? [],
    })
    .returning({ id: eventTypes.id });

  if (!wedding) throw new Error('Tip događaja nije napravljen.');
  return { weddingTypeId: wedding.id };
}

let userCounter = 0;

/** Pravi korisnika sa jedinstvenom email adresom. */
export async function createTestUser(
  overrides: { role?: 'user' | 'admin'; email?: string } = {},
): Promise<{ id: string; email: string }> {
  userCounter += 1;
  const email = overrides.email ?? `korisnik${userCounter}@primer.rs`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: `Korisnik ${userCounter}`,
      emailVerified: new Date(),
      role: overrides.role ?? 'user',
    })
    .returning({ id: users.id, email: users.email });

  if (!user) throw new Error('Test korisnik nije napravljen.');
  return user;
}

/** Podiže limit paketa kada test treba da napravi više događaja od besplatnog limita. */
export async function raiseEventLimit(limit: number | null): Promise<void> {
  await db
    .update(featurePlans)
    .set({
      features: {
        ...DEFAULT_PLANS.free,
        limits: { ...DEFAULT_PLANS.free.limits, maxEvents: limit },
      },
    })
    .where(eq(featurePlans.code, 'free'));
}
