import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { defaultFieldValues } from '@/features/templates/html-schema';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { checkLimit } from '@/features/billing/entitlements';
import {
  suggestEventName,
  type EventDetails,
} from '@/features/events/details';
import {
  toInstant,
  type CreateEventInput,
  type UpdateEventInput,
} from '@/features/events/schemas';
import { db } from '@/server/db';
import {
  activityEvents,
  eventTypes,
  events,
  invitations,
  templateVersions,
  templates,
  invitationSections,
} from '@/server/db/schema';
import { LimitExceededError, NotFoundError } from '@/server/authz/errors';
import { getAccountEntitlements, currentUsage } from './entitlements';
import { insertWithUniqueSlug } from './slug';

/**
 * Servisni sloj za događaje.
 *
 * Server akcije rade autorizaciju i validaciju, a ovaj sloj poslovna pravila i
 * pristup bazi. Podela znači da isti kod koriste i akcije, i seed, i testovi.
 */

export type EventListItem = {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  startsAt: Date | null;
  timeZone: string;
  city: string | null;
  eventTypeKey: string;
  eventTypeLabelKey: string;
  invitationSlug: string | null;
  invitationStatus: 'draft' | 'published' | 'unpublished' | null;
};

export async function listEventsForUser(userId: string): Promise<EventListItem[]> {
  return db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      city: events.city,
      eventTypeKey: eventTypes.key,
      eventTypeLabelKey: eventTypes.labelKey,
      invitationSlug: invitations.publicSlug,
      invitationStatus: invitations.status,
    })
    .from(events)
    .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
    .leftJoin(invitations, eq(invitations.eventId, events.id))
    .where(and(eq(events.ownerId, userId), isNull(events.deletedAt)))
    .orderBy(desc(events.createdAt));
}

export type EventDetailRow = {
  id: string;
  ownerId: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  details: EventDetails;
  startsAt: Date | null;
  timeZone: string;
  city: string | null;
  venueName: string | null;
  primaryLocale: 'sr-Latn' | 'sr-Cyrl' | 'en' | 'de';
  secondaryLocale: 'sr-Latn' | 'sr-Cyrl' | 'en' | 'de' | null;
  eventTypeId: string;
  eventTypeKey: string;
  eventTypeLabelKey: string;
  detailFields: string[];
  invitationId: string | null;
  invitationSlug: string | null;
  invitationStatus: 'draft' | 'published' | 'unpublished' | null;
};

export async function getEventDetail(
  eventId: string,
): Promise<EventDetailRow | null> {
  const [row] = await db
    .select({
      id: events.id,
      ownerId: events.ownerId,
      name: events.name,
      status: events.status,
      details: events.details,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      city: events.city,
      venueName: events.venueName,
      primaryLocale: events.primaryLocale,
      secondaryLocale: events.secondaryLocale,
      eventTypeId: eventTypes.id,
      eventTypeKey: eventTypes.key,
      eventTypeLabelKey: eventTypes.labelKey,
      detailFields: eventTypes.detailFields,
      invitationId: invitations.id,
      invitationSlug: invitations.publicSlug,
      invitationStatus: invitations.status,
    })
    .from(events)
    .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
    .leftJoin(invitations, eq(invitations.eventId, events.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  return row ?? null;
}

/**
 * Kreiranje događaja sa pozivnicom.
 *
 * Sve se dešava u jednoj transakciji: događaj bez pozivnice, ili pozivnica bez
 * rezervisanog sluga, nisu upotrebljiva stanja.
 */
export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<{ eventId: string; invitationId: string; slug: string }> {
  const entitlements = await getAccountEntitlements();
  const used = await currentUsage(userId, 'maxEvents');
  const limit = checkLimit(entitlements, 'maxEvents', used);

  if (!limit.allowed) {
    throw new LimitExceededError(
      `Vaš paket dozvoljava najviše ${limit.limit} događaja.`,
      { limit: limit.limit, current: limit.current, feature: 'maxEvents' },
    );
  }

  const [eventType] = await db
    .select({ id: eventTypes.id, key: eventTypes.key })
    .from(eventTypes)
    .where(and(eq(eventTypes.id, input.eventTypeId), eq(eventTypes.isActive, true)))
    .limit(1);

  if (!eventType) throw new NotFoundError('Izabrana vrsta proslave ne postoji.');

  const startsAt = toInstant(input.date || undefined, input.time || undefined, input.timeZone);
  const name =
    input.name.trim() ||
    suggestEventName(eventType.key, input.details, 'Nova pozivnica');

  // Šablon je opcion: prazna pozivnica je legitiman izbor (zahtev 1, korak 2).
  const templateSnapshot = input.templateId
    ? await loadTemplateSnapshot(input.templateId)
    : null;

  const htmlDefinitions =
    templateSnapshot?.kind === 'html' ? templateSnapshot.fieldDefinitions : null;

  const { result, claim } = await insertWithUniqueSlug(name, async (slug) =>
    db.transaction(async (tx) => {
      const [event] = await tx
        .insert(events)
        .values({
          ownerId: userId,
          eventTypeId: eventType.id,
          name,
          details: input.details,
          startsAt,
          timeZone: input.timeZone,
          city: input.city || null,
          venueName: input.venueName || null,
          primaryLocale: input.primaryLocale,
        })
        .returning({ id: events.id });

      if (!event) throw new Error('Događaj nije napravljen.');

      const [invitation] = await tx
        .insert(invitations)
        .values({
          eventId: event.id,
          publicSlug: slug,
          title: name,
          templateId: templateSnapshot?.templateId ?? null,
          templateVersionId: templateSnapshot?.versionId ?? null,
          themeTokens: templateSnapshot?.themeTokens ?? defaultThemeTokens,
          /*
           * HTML šablon: pozivnica kopira definicije polja i kreće od
           * podrazumevanih vrednosti iz šablona. Zahvaljujući tome nova
           * pozivnica odmah izgleda kao demo prikaz koji je korisnik i izabrao,
           * umesto da bude prazna (zahtev 39.2 i 39.4).
           */
          fieldDefinitions: htmlDefinitions,
          fieldValues: htmlDefinitions ? defaultFieldValues(htmlDefinitions) : null,
        })
        .returning({ id: invitations.id });

      if (!invitation) throw new Error('Pozivnica nije napravljena.');

      if (templateSnapshot && templateSnapshot.sections.length > 0) {
        await tx.insert(invitationSections).values(
          templateSnapshot.sections.map((section, index) => ({
            invitationId: invitation.id,
            type: section.type,
            schemaVersion: section.schemaVersion,
            position: section.position ?? index,
            isVisible: section.isVisible,
            data: section.data,
          })),
        );
      }

      return { eventId: event.id, invitationId: invitation.id };
    }),
  );

  return { ...result, slug: claim.slug };
}

/**
 * Snimak verzije šablona.
 *
 * Kopiramo temu i sekcije u pozivnicu umesto da ih referenciramo, jer kasnija
 * izmena šablona ne sme da promeni postojeću pozivnicu (zahtev 39.2 i 39.3).
 */
async function loadTemplateSnapshot(templateId: string) {
  const [row] = await db
    .select({
      templateId: templates.id,
      kind: templates.kind,
      versionId: templateVersions.id,
      themeTokens: templateVersions.themeTokens,
      sections: templateVersions.sections,
      /** Popunjeno samo za HTML šablone; kod sekcija ostaje `null`. */
      fieldDefinitions: templateVersions.fieldDefinitions,
    })
    .from(templates)
    .innerJoin(
      templateVersions,
      eq(templates.publishedVersionId, templateVersions.id),
    )
    .where(and(eq(templates.id, templateId), eq(templates.status, 'published')))
    .limit(1);

  return row ?? null;
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
): Promise<void> {
  const startsAt = toInstant(
    input.date || undefined,
    input.time || undefined,
    input.timeZone,
  );

  await db
    .update(events)
    .set({
      name: input.name.trim(),
      details: input.details,
      startsAt,
      timeZone: input.timeZone,
      city: input.city || null,
      venueName: input.venueName || null,
      primaryLocale: input.primaryLocale,
      secondaryLocale: input.secondaryLocale,
    })
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)));
}

/**
 * Meko brisanje događaja.
 *
 * Podaci gostiju ostaju nedostupni odmah, ali se fizički brišu tek po isteku
 * retencije (zahtev 25) - to daje prostor za oporavak posle greške korisnika.
 */
export async function softDeleteEvent(eventId: string): Promise<void> {
  await db
    .update(events)
    .set({ deletedAt: new Date(), status: 'archived' })
    .where(eq(events.id, eventId));

  await db
    .update(invitations)
    .set({ status: 'unpublished', unpublishedAt: new Date() })
    .where(eq(invitations.eventId, eventId));
}

/** Zapis u feed aktivnosti koji vidi organizator (zahtev 15). */
export async function recordActivity(input: {
  eventId: string;
  invitationId?: string | null;
  actorId?: string | null;
  kind: (typeof activityEvents.$inferInsert)['kind'];
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(activityEvents).values({
    eventId: input.eventId,
    invitationId: input.invitationId ?? null,
    actorId: input.actorId ?? null,
    kind: input.kind,
    payload: input.payload ?? {},
  });
}

export type DashboardStats = {
  views: number;
  responses: number;
  confirmed: number;
  adults: number;
  children: number;
  declined: number;
  pending: number;
};

/**
 * Zbirna statistika za kontrolni panel.
 *
 * Jedan upit sa agregacijom umesto više odvojenih: dashboard se otvara često i
 * ne sme da postane niz sekvencijalnih upita (zahtev 32).
 */
export async function getEventStats(eventId: string): Promise<DashboardStats> {
  const [row] = await db.execute<{
    responses: number;
    confirmed: number;
    adults: number;
    children: number;
    declined: number;
    pending: number;
    views: number;
  }>(sql`
    with inv as (
      select id from ${invitations} where event_id = ${eventId} limit 1
    )
    select
      coalesce((select count(*) from rsvp_responses r where r.invitation_id = (select id from inv)), 0)::int as responses,
      coalesce((select count(*) from rsvp_responses r where r.invitation_id = (select id from inv) and r.status = 'yes'), 0)::int as confirmed,
      coalesce((select sum(r.adults_count) from rsvp_responses r where r.invitation_id = (select id from inv) and r.status = 'yes'), 0)::int as adults,
      coalesce((select sum(r.children_count) from rsvp_responses r where r.invitation_id = (select id from inv) and r.status = 'yes'), 0)::int as children,
      coalesce((select count(*) from rsvp_responses r where r.invitation_id = (select id from inv) and r.status = 'no'), 0)::int as declined,
      coalesce((select count(*) from invitation_recipients ir where ir.invitation_id = (select id from inv)
                and not exists (select 1 from rsvp_responses r where r.recipient_id = ir.id)), 0)::int as pending,
      coalesce((select sum(s.views) from invitation_view_stats s where s.invitation_id = (select id from inv)), 0)::int as views
  `);

  return {
    views: row?.views ?? 0,
    responses: row?.responses ?? 0,
    confirmed: row?.confirmed ?? 0,
    adults: row?.adults ?? 0,
    children: row?.children ?? 0,
    declined: row?.declined ?? 0,
    pending: row?.pending ?? 0,
  };
}
