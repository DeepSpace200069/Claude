import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { db, type Database } from '@/server/db';
import { auditLogs, users } from '@/server/db/schema';

/**
 * Audit log (zahtev 24 i 39.10).
 *
 * Zapisuju se radnje koje menjaju novac, prava ili tuđ sadržaj: naplata,
 * besplatna aktivacija, administrativne izmene. Zapis se nikad ne menja i
 * nikad ne briše, pa nema `update` ni `delete` funkcije.
 *
 * `actorEmail` se pamti uz `actorId` namerno: kada korisnik obriše nalog,
 * `actor_id` postaje `null`, a trag mora da ostane čitljiv.
 */

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  changes?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Upis u audit log.
 *
 * Prima `tx` da bi zapis bio deo iste transakcije kao i radnja koju opisuje:
 * naplata koja je uspela, a nije zapisana, gora je od naplate koja nije uspela.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  tx: Database | Parameters<Parameters<Database['transaction']>[0]>[0] = db,
): Promise<void> {
  await tx.insert(auditLogs).values({
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    changes: entry.changes ?? null,
    ipHash: entry.ipHash ?? null,
    userAgent: entry.userAgent ?? null,
  });
}

export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  changes: Record<string, unknown> | null;
  createdAt: Date;
};

/** Poslednji zapisi za admin pregled (zahtev 7.8). */
export async function listAuditLog(
  options: { limit?: number; entityType?: string } = {},
): Promise<AuditRow[]> {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      // Email iz zapisa je izvor istine; spoj sa `users` samo dopunjava zapise
      // starije od trenutka kada je email počeo da se pamti.
      actorEmail: auditLogs.actorEmail,
      changes: auditLogs.changes,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(options.entityType ? eq(auditLogs.entityType, options.entityType) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit ?? 100);
}
