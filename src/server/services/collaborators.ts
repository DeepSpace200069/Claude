import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { can, limitFor } from '@/features/billing/entitlements';
import { getEnv } from '@/lib/env';
import { hashToken, randomToken } from '@/lib/ids';
import { db } from '@/server/db';
import { eventCollaborators, events, users } from '@/server/db/schema';
import { getEmailAdapter } from '@/server/adapters/email';
import { collaboratorInviteEmail } from '@/server/adapters/email/templates';
import {
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '@/server/authz/errors';
import type { Locale } from '@/i18n/config';

import { getEventEntitlements } from './entitlements';

/**
 * Saradnici na događaju (zahtev 7.9 i 25).
 *
 * Poziv nosi token koji se u bazi čuva **samo kao heš**: sam token postoji
 * jedino u poslatom mejlu, pa ni pristup bazi ne daje mogućnost da se tuđi
 * poziv prihvati (isto pravilo kao za lične linkove gostiju, zahtev 39.6).
 *
 * Broj saradnika je limit paketa, a paket se kupuje po pozivnici - zato se
 * prava čitaju kroz `getEventEntitlements(eventId)`.
 */

export type CollaboratorRole = 'editor' | 'guest_manager' | 'viewer';

export type CollaboratorRow = {
  id: string;
  email: string;
  name: string | null;
  role: CollaboratorRole;
  status: 'pending' | 'accepted' | 'revoked';
  invitedAt: Date;
  acceptedAt: Date | null;
};

/** Poziv važi sedam dana - dovoljno da se mejl pročita, prekratko da zastari. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function listCollaborators(eventId: string): Promise<CollaboratorRow[]> {
  return db
    .select({
      id: eventCollaborators.id,
      email: eventCollaborators.email,
      name: users.name,
      role: eventCollaborators.role,
      status: eventCollaborators.status,
      invitedAt: eventCollaborators.createdAt,
      acceptedAt: eventCollaborators.acceptedAt,
    })
    .from(eventCollaborators)
    .leftJoin(users, eq(eventCollaborators.userId, users.id))
    .where(eq(eventCollaborators.eventId, eventId))
    .orderBy(eventCollaborators.createdAt);
}

/**
 * Provera limita saradnika.
 *
 * Broje se samo pozivi koji nešto troše - opozvani ne. Vlasnik se ne broji: on
 * nije saradnik nego vlasnik.
 */
async function assertCollaboratorAllowed(eventId: string): Promise<void> {
  const entitlements = await getEventEntitlements(eventId);

  if (!can(entitlements, 'collaborators')) {
    throw new ValidationError(
      `Paket „${entitlements.planName}” ne uključuje saradnike.`,
      { plan: ['Nadogradite paket da biste pozvali saradnika.'] },
    );
  }

  const limit = limitFor(entitlements, 'maxCollaborators');
  if (limit === null) return;

  const current = (await listCollaborators(eventId)).filter(
    (row) => row.status !== 'revoked',
  ).length;

  if (current >= limit) {
    throw new LimitExceededError(
      `Paket „${entitlements.planName}” dozvoljava najviše ${limit} saradnika.`,
      { limit, current, feature: 'maxCollaborators' },
    );
  }
}

/**
 * Poziv saradnika.
 *
 * Ponovni poziv iste adrese ne pravi drugi red (jedinstveni indeks nad
 * `event_id, email`), nego osvežava token i rok - „pošalji ponovo” je normalna
 * radnja, a ne greška.
 */
export async function inviteCollaborator(input: {
  eventId: string;
  email: string;
  role: CollaboratorRole;
  invitedBy: { id: string; name: string | null; email: string };
  locale: Locale;
}): Promise<{ collaboratorId: string; emailSent: boolean }> {
  const email = input.email.trim().toLowerCase();

  const [event] = await db
    .select({ id: events.id, name: events.name, ownerId: events.ownerId })
    .from(events)
    .where(and(eq(events.id, input.eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Događaj ne postoji.');

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, event.ownerId))
    .limit(1);

  if (owner?.email.toLowerCase() === email) {
    throw new ValidationError('Vlasnik već ima pun pristup događaju.', {
      email: ['Ova adresa je vlasnik događaja.'],
    });
  }

  const [existing] = await db
    .select({ id: eventCollaborators.id, status: eventCollaborators.status })
    .from(eventCollaborators)
    .where(
      and(
        eq(eventCollaborators.eventId, input.eventId),
        eq(eventCollaborators.email, email),
      ),
    )
    .limit(1);

  if (existing?.status === 'accepted') {
    throw new ValidationError('Ta osoba je već saradnik na ovom događaju.', {
      email: ['Saradnik već postoji.'],
    });
  }

  if (!existing) await assertCollaboratorAllowed(input.eventId);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Ako korisnik sa tom adresom već postoji, poziv se odmah vezuje za njegov
  // nalog; ako ne postoji, `user_id` ostaje prazan do prihvatanja.
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const values = {
    eventId: input.eventId,
    email,
    role: input.role,
    status: 'pending' as const,
    userId: account?.id ?? null,
    inviteTokenHash: hashToken(token),
    inviteExpiresAt: expiresAt,
    invitedById: input.invitedBy.id,
    acceptedAt: null,
  };

  const collaboratorId = existing
    ? ((await db
        .update(eventCollaborators)
        .set(values)
        .where(eq(eventCollaborators.id, existing.id))
        .returning({ id: eventCollaborators.id }))[0]?.id ?? existing.id)
    : ((await db
        .insert(eventCollaborators)
        .values(values)
        .returning({ id: eventCollaborators.id }))[0]?.id ?? '');

  const message = await collaboratorInviteEmail({
    to: email,
    inviterName: input.invitedBy.name ?? input.invitedBy.email,
    eventName: event.name,
    url: `${getEnv().APP_URL}/app/pozivi/${token}`,
    locale: input.locale,
  });

  const sent = await getEmailAdapter().send(message);

  // Neuspelo slanje ne poništava poziv: link se može poslati ponovo, a red u
  // bazi je jedini izvor istine o tome ko je pozvan.
  return { collaboratorId, emailSent: sent.ok };
}

export type InviteAcceptance =
  | { state: 'ok'; eventId: string; eventName: string }
  | { state: 'invalid' }
  | { state: 'expired' }
  | { state: 'wrong_account'; invitedEmail: string };

/**
 * Prihvatanje poziva.
 *
 * Adresa naloga mora da se poklopi sa pozvanom: bez te provere bi svako ko
 * dobije prosleđen link ušao u tuđ događaj.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string },
): Promise<InviteAcceptance> {
  const [row] = await db
    .select({
      id: eventCollaborators.id,
      eventId: eventCollaborators.eventId,
      email: eventCollaborators.email,
      status: eventCollaborators.status,
      expiresAt: eventCollaborators.inviteExpiresAt,
      eventName: events.name,
    })
    .from(eventCollaborators)
    .innerJoin(events, eq(eventCollaborators.eventId, events.id))
    .where(eq(eventCollaborators.inviteTokenHash, hashToken(token)))
    .limit(1);

  if (!row || row.status === 'revoked') return { state: 'invalid' };

  if (row.email.toLowerCase() !== user.email.toLowerCase()) {
    return { state: 'wrong_account', invitedEmail: row.email };
  }

  if (row.status === 'accepted') {
    return { state: 'ok', eventId: row.eventId, eventName: row.eventName };
  }

  if (row.expiresAt && row.expiresAt < new Date()) return { state: 'expired' };

  await db
    .update(eventCollaborators)
    .set({
      status: 'accepted',
      userId: user.id,
      acceptedAt: new Date(),
      // Token se troši prihvatanjem: isti link ne sme da radi dvaput.
      inviteTokenHash: null,
      inviteExpiresAt: null,
    })
    .where(eq(eventCollaborators.id, row.id));

  return { state: 'ok', eventId: row.eventId, eventName: row.eventName };
}

export async function changeCollaboratorRole(input: {
  eventId: string;
  collaboratorId: string;
  role: CollaboratorRole;
}): Promise<void> {
  const result = await db
    .update(eventCollaborators)
    .set({ role: input.role })
    .where(
      and(
        eq(eventCollaborators.id, input.collaboratorId),
        // Scope po događaju je odbrana od IDOR-a: ID saradnika iz forme nije dokaz pristupa.
        eq(eventCollaborators.eventId, input.eventId),
      ),
    )
    .returning({ id: eventCollaborators.id });

  if (result.length === 0) throw new NotFoundError('Saradnik ne postoji.');
}

/**
 * Opoziv pristupa.
 *
 * Red se ne briše nego prelazi u `revoked`: tako se vidi da je neko imao
 * pristup i da mu je oduzet, a i nevažeći token ostaje nevažeći.
 */
export async function revokeCollaborator(input: {
  eventId: string;
  collaboratorId: string;
}): Promise<void> {
  const result = await db
    .update(eventCollaborators)
    .set({
      status: 'revoked',
      inviteTokenHash: null,
      inviteExpiresAt: null,
    })
    .where(
      and(
        eq(eventCollaborators.id, input.collaboratorId),
        eq(eventCollaborators.eventId, input.eventId),
      ),
    )
    .returning({ id: eventCollaborators.id });

  if (result.length === 0) throw new NotFoundError('Saradnik ne postoji.');
}
