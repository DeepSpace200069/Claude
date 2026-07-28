import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';
import { cache } from 'react';

import type { Locale } from '@/i18n/config';
import { db } from '@/server/db';
import { eventCollaborators, events } from '@/server/db/schema';
import { auth } from '@/server/auth';

import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from './errors';
import {
  OWNER_ONLY_PERMISSIONS,
  roleHasPermission,
  type EventRole,
  type Permission,
} from './permissions';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'user' | 'admin';
  locale: Locale;
};

/**
 * Trenutni korisnik ili `null`.
 *
 * `cache()` znači da se sesija čita jednom po zahtevu, bez obzira koliko
 * server komponenti je zatraži.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
    locale: session.user.locale,
  };
});

/** Korisnik ili greška - koristi se u svakoj server akciji. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new AuthorizationError('Ova stranica je dostupna samo administratoru.');
  }
  return user;
}

export type EventAccess = {
  user: CurrentUser;
  eventId: string;
  role: EventRole;
  isOwner: boolean;
};

/**
 * Provera pristupa jednom događaju.
 *
 * Ovo je centralna odbrana od IDOR-a: svaka ruta i server akcija koja dobije
 * `eventId` iz URL-a ili iz forme mora proći kroz nju **pre** bilo kakvog
 * čitanja ili pisanja (zahtev 39.5).
 *
 * Administrator ima pristup radi podrške, ali njegove radnje se beleže u audit
 * log na mestu poziva.
 */
export async function requireEventAccess(
  eventId: string,
  permission: Permission,
): Promise<EventAccess> {
  const user = await requireUser();

  const [event] = await db
    .select({ id: events.id, ownerId: events.ownerId })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!event) throw new NotFoundError('Događaj ne postoji ili nemate pristup.');

  if (event.ownerId === user.id) {
    return { user, eventId, role: 'owner', isOwner: true };
  }

  if (user.role === 'admin') {
    return { user, eventId, role: 'owner', isOwner: false };
  }

  const [collaborator] = await db
    .select({ role: eventCollaborators.role })
    .from(eventCollaborators)
    .where(
      and(
        eq(eventCollaborators.eventId, eventId),
        eq(eventCollaborators.userId, user.id),
        eq(eventCollaborators.status, 'accepted'),
      ),
    )
    .limit(1);

  if (!collaborator) {
    // Namerno "ne postoji", a ne "zabranjeno" - ne otkrivamo tuđe događaje.
    throw new NotFoundError('Događaj ne postoji ili nemate pristup.');
  }

  const role: EventRole = collaborator.role;

  if (OWNER_ONLY_PERMISSIONS.includes(permission)) {
    throw new AuthorizationError(
      'Ovu radnju može da izvrši samo vlasnik događaja.',
    );
  }

  if (!roleHasPermission(role, permission)) {
    throw new AuthorizationError();
  }

  return { user, eventId, role, isOwner: false };
}

export * from './errors';
export * from './permissions';
