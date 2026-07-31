import 'server-only';

import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import { getEnv } from '@/lib/env';
import { db } from '@/server/db';
import {
  accounts,
  eventCollaborators,
  events,
  featurePlans,
  guestHouseholds,
  guestbookEntries,
  guests,
  invitationRecipients,
  invitationSections,
  invitationViewStats,
  invitations,
  orders,
  rsvpAnswers,
  rsvpQuestions,
  rsvpResponses,
  sessions,
  users,
  verificationTokens,
  webhookEvents,
} from '@/server/db/schema';
import { NotFoundError } from '@/server/authz/errors';
import { pruneRateLimits } from '@/server/rate-limit';

import { writeAuditLog } from './audit';

/**
 * Privatnost: preuzimanje podataka, brisanje naloga i retencija (zahtev 25).
 *
 * Tri obaveze koje se lako obećaju u pravnom tekstu, a teško ispune u kodu:
 *
 * 1. **Preuzimanje** mora da vrati sve što o korisniku zaista imamo, u obliku
 *    koji se može pročitati bez naše aplikacije - dakle JSON, a ne izvoz koji
 *    otvara samo naš uređivač.
 * 2. **Brisanje** ne sme da obriše ono što po zakonu mora da ostane. Narudžbine
 *    su finansijski trag (`orders.user_id` je `on delete restrict`), pa se
 *    nalog **anonimizuje**, a lični sadržaj briše. Rezultat je isti za
 *    korisnika: niko više ne može da ga poveže sa tim podacima.
 * 3. **Retencija** mora nekoga da briše sama od sebe, inače „čuvamo najviše
 *    godinu dana” nije tačno.
 */

export type UserDataExport = {
  format: 'pozivnica-export';
  version: 1;
  exportedAt: string;
  profile: Record<string, unknown>;
  events: unknown[];
  invitations: unknown[];
  guests: unknown[];
  households: unknown[];
  responses: unknown[];
  guestbook: unknown[];
  orders: unknown[];
  collaborators: unknown[];
  collaborations: unknown[];
};

/** ID-jevi događaja koje korisnik poseduje - osnova za sve ostale upite. */
async function ownedEventIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.ownerId, userId));

  return rows.map((row) => row.id);
}

/**
 * Sve što o korisniku imamo, u jednom JSON-u.
 *
 * Podaci gostiju su tu jer ih je organizator uneo i jer su njegovi za tu
 * proslavu - izvoz bez spiska gostiju bio bi izvoz koji izostavlja ono zbog
 * čega ga ljudi i traže. Tokeni i heševi se **ne** izvoze: oni su tajne, a ne
 * podaci.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      locale: users.locale,
      role: users.role,
      rsvpNotifications: users.rsvpNotifications,
      marketingConsentAt: users.marketingConsentAt,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!profile) throw new NotFoundError('Korisnik ne postoji.');

  const eventIds = await ownedEventIds(userId);
  const scope = eventIds.length > 0;

  const [
    eventRows,
    invitationRows,
    sectionRows,
    guestRows,
    householdRows,
    responseRows,
    answerRows,
    guestbookRows,
    orderRows,
    collaboratorRows,
    collaborationRows,
  ] = await Promise.all([
    scope
      ? db.select().from(events).where(inArray(events.id, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            id: invitations.id,
            eventId: invitations.eventId,
            publicSlug: invitations.publicSlug,
            status: invitations.status,
            privacy: invitations.privacy,
            title: invitations.title,
            publishedAt: invitations.publishedAt,
            expiresAt: invitations.expiresAt,
            themeTokens: invitations.themeTokens,
          })
          .from(invitations)
          .where(inArray(invitations.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            invitationId: invitationSections.invitationId,
            type: invitationSections.type,
            position: invitationSections.position,
            isVisible: invitationSections.isVisible,
            data: invitationSections.data,
          })
          .from(invitationSections)
          .innerJoin(
            invitations,
            eq(invitationSections.invitationId, invitations.id),
          )
          .where(inArray(invitations.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            id: guests.id,
            eventId: guests.eventId,
            firstName: guests.firstName,
            lastName: guests.lastName,
            email: guests.email,
            phone: guests.phone,
            tags: guests.tags,
            privateNote: guests.privateNote,
            householdId: guests.householdId,
          })
          .from(guests)
          .where(inArray(guests.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select()
          .from(guestHouseholds)
          .where(inArray(guestHouseholds.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            id: rsvpResponses.id,
            invitationId: rsvpResponses.invitationId,
            fullName: rsvpResponses.fullName,
            status: rsvpResponses.status,
            adults: rsvpResponses.adultsCount,
            children: rsvpResponses.childrenCount,
            message: rsvpResponses.message,
            submittedAt: rsvpResponses.createdAt,
          })
          .from(rsvpResponses)
          .innerJoin(invitations, eq(rsvpResponses.invitationId, invitations.id))
          .where(inArray(invitations.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            responseId: rsvpAnswers.responseId,
            question: rsvpQuestions.label,
            value: rsvpAnswers.value,
          })
          .from(rsvpAnswers)
          .innerJoin(rsvpQuestions, eq(rsvpAnswers.questionId, rsvpQuestions.id))
          .innerJoin(invitations, eq(rsvpQuestions.invitationId, invitations.id))
          .where(inArray(invitations.eventId, eventIds))
      : Promise.resolve([]),
    scope
      ? db
          .select({
            invitationId: guestbookEntries.invitationId,
            authorName: guestbookEntries.authorName,
            message: guestbookEntries.message,
            status: guestbookEntries.status,
            createdAt: guestbookEntries.createdAt,
          })
          .from(guestbookEntries)
          .innerJoin(
            invitations,
            eq(guestbookEntries.invitationId, invitations.id),
          )
          .where(inArray(invitations.eventId, eventIds))
      : Promise.resolve([]),
    db
      .select({
        id: orders.id,
        eventId: orders.eventId,
        plan: featurePlans.name,
        status: orders.status,
        totalMinor: orders.totalMinor,
        currency: orders.currency,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .innerJoin(featurePlans, eq(orders.planId, featurePlans.id))
      .where(eq(orders.userId, userId)),
    scope
      ? db
          .select({
            eventId: eventCollaborators.eventId,
            email: eventCollaborators.email,
            role: eventCollaborators.role,
            status: eventCollaborators.status,
            invitedAt: eventCollaborators.createdAt,
          })
          .from(eventCollaborators)
          .where(inArray(eventCollaborators.eventId, eventIds))
      : Promise.resolve([]),
    db
      .select({
        eventId: eventCollaborators.eventId,
        role: eventCollaborators.role,
        status: eventCollaborators.status,
        acceptedAt: eventCollaborators.acceptedAt,
      })
      .from(eventCollaborators)
      .where(eq(eventCollaborators.userId, userId)),
  ]);

  const answersByResponse = new Map<string, unknown[]>();
  for (const answer of answerRows) {
    const list = answersByResponse.get(answer.responseId) ?? [];
    list.push({ question: answer.question, value: answer.value });
    answersByResponse.set(answer.responseId, list);
  }

  return {
    format: 'pozivnica-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    events: eventRows,
    invitations: invitationRows.map((invitation) => ({
      ...invitation,
      sections: sectionRows.filter(
        (section) => section.invitationId === invitation.id,
      ),
    })),
    guests: guestRows,
    households: householdRows,
    responses: responseRows.map((response) => ({
      ...response,
      answers: answersByResponse.get(response.id) ?? [],
    })),
    guestbook: guestbookRows,
    orders: orderRows,
    collaborators: collaboratorRows,
    collaborations: collaborationRows,
  };
}

export type DeletionResult = {
  deletedEvents: number;
  keptOrders: number;
};

/**
 * Brisanje naloga.
 *
 * Lični sadržaj se **stvarno briše**: događaji odlaze zajedno sa pozivnicama,
 * gostima, odgovorima i rasporedom (kaskada u šemi). Sam red korisnika ostaje,
 * ali anonimizovan - jer narudžbine po zakonu moraju da postoje, a
 * `orders.user_id` je `on delete restrict`. Posle ovoga nijedan podatak u bazi
 * ne vodi do osobe: email je zamenjen tehničkim, ime obrisano, prijava
 * nemoguća.
 *
 * Audit zapis namerno **ne** nosi email. Zapis o brisanju koji čuva adresu bio
 * bi brisanje samo na papiru.
 */
export async function deleteAccount(userId: string): Promise<DeletionResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundError('Korisnik ne postoji.');

    const owned = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.ownerId, userId));

    if (owned.length > 0) {
      await tx.delete(events).where(
        inArray(
          events.id,
          owned.map((row) => row.id),
        ),
      );
    }

    const keptOrders = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, userId));

    // Prijava mora da prestane da radi odmah: sesije i povezani nalozi odlaze.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));

    await tx
      .update(users)
      .set({
        // Tehnički domen koji ne postoji - adresa se ne može ni slučajno
        // upotrebiti, a jedinstvenost ostaje zadovoljena.
        email: `obrisan-${userId}@obrisano.invalid`,
        name: null,
        image: null,
        emailVerified: null,
        marketingConsentAt: null,
        lastSeenAt: null,
        deletedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await writeAuditLog(
      {
        action: 'user.account_deleted',
        entityType: 'user',
        entityId: userId,
        actorId: userId,
        actorEmail: null,
        changes: { deletedEvents: owned.length, keptOrders: keptOrders.length },
      },
      tx,
    );

    return { deletedEvents: owned.length, keptOrders: keptOrders.length };
  });
}

export type RetentionReport = {
  events: number;
  viewStats: number;
  webhookEvents: number;
  sessions: number;
  verificationTokens: number;
  invites: number;
  rateLimits: number;
};

/**
 * Retencija (zahtev 25).
 *
 * Meko obrisan događaj postoji da bi korisnik mogao da se predomisli; posle
 * `DATA_RETENTION_DAYS` više nema koga da se predomišlja, pa odlazi zaista.
 * Isto važi za statistiku pregleda i obrađene webhookove.
 *
 * Audit log se **ne** briše: on je pravni trag o administrativnim radnjama i ne
 * sadrži sadržaj pozivnica.
 */
export async function pruneExpiredData(
  now: Date = new Date(),
): Promise<RetentionReport> {
  const days = getEnv().DATA_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const deletedEvents = await db
    .delete(events)
    .where(and(isNotNull(events.deletedAt), lt(events.deletedAt, cutoff)))
    .returning({ id: events.id });

  const deletedStats = await db
    .delete(invitationViewStats)
    .where(lt(invitationViewStats.day, cutoff.toISOString().slice(0, 10)))
    .returning({ id: invitationViewStats.id });

  const deletedWebhooks = await db
    .delete(webhookEvents)
    .where(lt(webhookEvents.createdAt, cutoff))
    .returning({ id: webhookEvents.id });

  const deletedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expires, now))
    .returning({ token: sessions.sessionToken });

  const deletedTokens = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, now))
    .returning({ token: verificationTokens.token });

  /*
   * Istekao poziv saradniku gubi token, ali red ostaje u stanju `pending`:
   * vlasnik treba da vidi da je poziv poslat i da nije prihvaćen. Briše se samo
   * tajna, jer ona više ničemu ne služi.
   */
  const expiredInvites = await db
    .update(eventCollaborators)
    .set({ inviteTokenHash: null, inviteExpiresAt: null })
    .where(
      and(
        isNotNull(eventCollaborators.inviteTokenHash),
        lt(eventCollaborators.inviteExpiresAt, now),
      ),
    )
    .returning({ id: eventCollaborators.id });

  const rateLimitRows = await pruneRateLimits();

  return {
    events: deletedEvents.length,
    viewStats: deletedStats.length,
    webhookEvents: deletedWebhooks.length,
    sessions: deletedSessions.length,
    verificationTokens: deletedTokens.length,
    invites: expiredInvites.length,
    rateLimits: rateLimitRows,
  };
}

/** Koliko dana čuvamo meko obrisane podatke - prikazuje se korisniku. */
export function retentionDays(): number {
  return getEnv().DATA_RETENTION_DAYS;
}

/** Broj primalaca i odgovora koji nestaju sa nalogom - za ekran potvrde. */
export async function deletionPreview(userId: string): Promise<{
  events: number;
  guests: number;
  responses: number;
  orders: number;
}> {
  const eventIds = await ownedEventIds(userId);

  if (eventIds.length === 0) {
    const [orderCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.userId, userId));

    return { events: 0, guests: 0, responses: 0, orders: orderCount?.value ?? 0 };
  }

  const [[guestCount], [responseCount], [orderCount], [recipientCount]] =
    await Promise.all([
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(guests)
        .where(inArray(guests.eventId, eventIds)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(rsvpResponses)
        .innerJoin(invitations, eq(rsvpResponses.invitationId, invitations.id))
        .where(inArray(invitations.eventId, eventIds)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(orders)
        .where(eq(orders.userId, userId)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(invitationRecipients)
        .innerJoin(invitations, eq(invitationRecipients.invitationId, invitations.id))
        .where(inArray(invitations.eventId, eventIds)),
    ]);

  return {
    events: eventIds.length,
    // Primaoci bez unetog gosta se takođe brišu, pa ih brojimo zajedno.
    guests: (guestCount?.value ?? 0) + (recipientCount?.value ?? 0),
    responses: responseCount?.value ?? 0,
    orders: orderCount?.value ?? 0,
  };
}
