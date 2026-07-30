import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import type { GuestbookEntryView } from '@/features/rsvp/types';
import { db } from '@/server/db';
import { guestbookEntries } from '@/server/db/schema';
import { NotFoundError } from '@/server/authz/errors';

import { requireInvitationId } from './rsvp';

/**
 * Knjiga želja sa moderacijom (zahtev 9).
 *
 * Podrazumevano stanje poruke je „čeka odobrenje": javna forma bez naloga je
 * mesto gde pre ili kasnije stigne nešto što domaćini ne žele da im gosti vide
 * na dan venčanja. Organizator može da isključi moderaciju u sekciji, ali to
 * mora da bude njegova svesna odluka, a ne podrazumevano ponašanje.
 */
export const PUBLIC_ENTRY_LIMIT = 50;

export async function listApprovedEntries(
  invitationId: string,
  limit: number = PUBLIC_ENTRY_LIMIT,
): Promise<GuestbookEntryView[]> {
  const rows = await db
    .select({
      id: guestbookEntries.id,
      authorName: guestbookEntries.authorName,
      message: guestbookEntries.message,
      reaction: guestbookEntries.reaction,
      createdAt: guestbookEntries.createdAt,
    })
    .from(guestbookEntries)
    .where(
      and(
        eq(guestbookEntries.invitationId, invitationId),
        eq(guestbookEntries.status, 'approved'),
      ),
    )
    .orderBy(desc(guestbookEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    authorName: row.authorName,
    message: row.message,
    reaction: row.reaction,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function addGuestbookEntry(input: {
  invitationId: string;
  authorName: string;
  message: string;
  reaction: string | null;
  ipHash: string | null;
  requireApproval: boolean;
}): Promise<{ entryId: string; status: 'pending' | 'approved' }> {
  const status = input.requireApproval ? 'pending' : 'approved';

  const [created] = await db
    .insert(guestbookEntries)
    .values({
      invitationId: input.invitationId,
      authorName: input.authorName,
      message: input.message,
      reaction: input.reaction,
      status,
      ipHash: input.ipHash,
    })
    .returning({ id: guestbookEntries.id });

  if (!created) throw new Error('Poruka nije upisana.');
  return { entryId: created.id, status };
}

export type GuestbookRow = {
  id: string;
  authorName: string;
  message: string;
  reaction: string | null;
  status: 'pending' | 'approved' | 'hidden';
  createdAt: Date;
};

export async function listGuestbookEntries(
  eventId: string,
  status: 'sve' | 'pending' | 'approved' | 'hidden' = 'sve',
): Promise<GuestbookRow[]> {
  const { invitationId } = await requireInvitationId(eventId);

  const conditions = [eq(guestbookEntries.invitationId, invitationId)];
  if (status !== 'sve') conditions.push(eq(guestbookEntries.status, status));

  return db
    .select({
      id: guestbookEntries.id,
      authorName: guestbookEntries.authorName,
      message: guestbookEntries.message,
      reaction: guestbookEntries.reaction,
      status: guestbookEntries.status,
      createdAt: guestbookEntries.createdAt,
    })
    .from(guestbookEntries)
    .where(and(...conditions))
    .orderBy(desc(guestbookEntries.createdAt));
}

export async function countPendingEntries(eventId: string): Promise<number> {
  const entries = await listGuestbookEntries(eventId, 'pending');
  return entries.length;
}

export async function moderateGuestbookEntry(
  eventId: string,
  entryId: string,
  status: 'approved' | 'hidden',
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);

  const updated = await db
    .update(guestbookEntries)
    .set({ status })
    .where(
      and(
        eq(guestbookEntries.id, entryId),
        eq(guestbookEntries.invitationId, invitationId),
      ),
    )
    .returning({ id: guestbookEntries.id });

  if (updated.length === 0) throw new NotFoundError('Poruka ne postoji.');
}

export async function deleteGuestbookEntry(
  eventId: string,
  entryId: string,
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);

  const deleted = await db
    .delete(guestbookEntries)
    .where(
      and(
        eq(guestbookEntries.id, entryId),
        eq(guestbookEntries.invitationId, invitationId),
      ),
    )
    .returning({ id: guestbookEntries.id });

  if (deleted.length === 0) throw new NotFoundError('Poruka ne postoji.');
}
