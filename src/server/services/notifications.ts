import 'server-only';

import { and, eq, gt, isNull } from 'drizzle-orm';

import { appUrl } from '@/config/brand';
import { formatCurrency } from '@/i18n/format';
import type { Locale } from '@/i18n/config';
import { db } from '@/server/db';
import {
  events,
  featurePlans,
  invitations,
  orders,
  rsvpResponses,
  users,
} from '@/server/db/schema';
import { getEmailAdapter } from '@/server/adapters/email';
import {
  paymentReceiptEmail,
  rsvpDigestEmail,
  rsvpNotificationEmail,
} from '@/server/adapters/email/templates';

/**
 * Email obaveštenja (zahtev 28).
 *
 * Učestalost bira **primalac**, u profilu, i ona se poštuje na jednom mestu -
 * ovde. Nijedan servis ne šalje poštu mimo ovoga, pa „nikad” zaista znači
 * nikad, a ne „nikad osim jedne poruke koju je neko zaboravio da veže za
 * podešavanje”.
 *
 * | Podešavanje | Ponašanje |
 * |-------------|-----------|
 * | `immediate` | poruka po svakom odgovoru |
 * | `daily` | jedan rezime dnevno, samo ako je nešto stiglo |
 * | `weekly` | jedan rezime nedeljno, samo ako je nešto stiglo |
 * | `never` | ništa |
 *
 * Potvrda uplate **ne** zavisi od ovog podešavanja: to je račun, a ne
 * obaveštenje o tuđoj radnji, i šalje se uvek.
 */

type Owner = {
  id: string;
  email: string;
  locale: Locale;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
};

async function ownerOfEvent(eventId: string): Promise<Owner | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      locale: users.locale,
      frequency: users.rsvpNotifications,
    })
    .from(events)
    .innerJoin(users, eq(events.ownerId, users.id))
    .where(and(eq(events.id, eventId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

/**
 * Obaveštenje o novom odgovoru.
 *
 * Vraća šta je urađeno da bi pozivalac (i test) znao da li je poruka poslata,
 * odložena za rezime ili preskočena. Greška u slanju **ne** ruši upis odgovora:
 * gost je svoje uradio, a pošta je posledica.
 */
export async function notifyNewResponse(input: {
  eventId: string;
  guestName: string;
  status: 'yes' | 'no' | 'maybe';
  people: number;
}): Promise<'sent' | 'queued' | 'skipped'> {
  const owner = await ownerOfEvent(input.eventId);

  if (!owner || owner.frequency === 'never') return 'skipped';
  // Rezime se sastavlja kasnije, iz samih odgovora - nema posebnog reda čekanja.
  if (owner.frequency !== 'immediate') return 'queued';

  const [event] = await db
    .select({ name: events.name })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);

  const message = await rsvpNotificationEmail({
    to: owner.email,
    eventName: event?.name ?? '',
    guestName: input.guestName,
    status: input.status,
    people: input.people,
    url: appUrl(`/app/dogadjaji/${input.eventId}/odgovori`),
    locale: owner.locale,
  });

  const result = await getEmailAdapter().send(message);
  return result.ok ? 'sent' : 'skipped';
}

export type DigestReport = { sent: number; skipped: number };

/**
 * Slanje dnevnih i nedeljnih rezimea.
 *
 * Poziva se iz zadatka održavanja. Granica je `users.last_digest_at`, a ne
 * „poslednja 24 sata”: ako zadatak jednom ne odradi posao, sledeći put se
 * pošalje sve što je u međuvremenu stiglo, umesto da odgovori tiho propadnu.
 */
export async function sendPendingDigests(
  period: 'daily' | 'weekly',
  now: Date = new Date(),
): Promise<DigestReport> {
  const windowMs = period === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const fallbackSince = new Date(now.getTime() - windowMs);

  const candidates = await db
    .select({
      id: users.id,
      email: users.email,
      locale: users.locale,
      lastDigestAt: users.lastDigestAt,
    })
    .from(users)
    .where(and(eq(users.rsvpNotifications, period), isNull(users.deletedAt)));

  let sent = 0;
  let skipped = 0;

  for (const owner of candidates) {
    const since = owner.lastDigestAt ?? fallbackSince;

    // Rezime se ne šalje pre isteka perioda, pa dva pokretanja u istom danu ne
    // znače dve poruke.
    if (owner.lastDigestAt && now.getTime() - owner.lastDigestAt.getTime() < windowMs) {
      skipped += 1;
      continue;
    }

    const rows = await db
      .select({
        eventId: events.id,
        eventName: events.name,
        status: rsvpResponses.status,
        adults: rsvpResponses.adultsCount,
        children: rsvpResponses.childrenCount,
      })
      .from(rsvpResponses)
      .innerJoin(invitations, eq(rsvpResponses.invitationId, invitations.id))
      .innerJoin(events, eq(invitations.eventId, events.id))
      .where(
        and(
          eq(events.ownerId, owner.id),
          isNull(events.deletedAt),
          gt(rsvpResponses.createdAt, since),
        ),
      );

    if (rows.length === 0) {
      skipped += 1;
      continue;
    }

    const byEvent = new Map<
      string,
      { name: string; yes: number; no: number; maybe: number; people: number }
    >();

    for (const row of rows) {
      const entry = byEvent.get(row.eventId) ?? {
        name: row.eventName,
        yes: 0,
        no: 0,
        maybe: 0,
        people: 0,
      };

      if (row.status === 'yes') {
        entry.yes += 1;
        entry.people += row.adults + row.children;
      } else if (row.status === 'no') {
        entry.no += 1;
      } else if (row.status === 'maybe') {
        entry.maybe += 1;
      }

      byEvent.set(row.eventId, entry);
    }

    const message = await rsvpDigestEmail({
      to: owner.email,
      period,
      events: [...byEvent.values()],
      url: appUrl('/app/dogadjaji'),
      locale: owner.locale,
    });

    const result = await getEmailAdapter().send(message);

    if (!result.ok) {
      // Bez pomeranja granice: sledeći pokušaj šalje iste odgovore, umesto da
      // ih izgubi zato što je provajder bio nedostupan.
      skipped += 1;
      continue;
    }

    await db.update(users).set({ lastDigestAt: now }).where(eq(users.id, owner.id));
    sent += 1;
  }

  return { sent, skipped };
}

/**
 * Potvrda uplate.
 *
 * Šalje se svima, bez obzira na podešavanje učestalosti - račun nije
 * obaveštenje o tuđoj radnji nego dokaz o sopstvenoj.
 */
export async function sendPaymentReceipt(orderId: string): Promise<boolean> {
  const [row] = await db
    .select({
      email: users.email,
      locale: users.locale,
      eventName: events.name,
      planName: featurePlans.name,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      eventId: orders.eventId,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .innerJoin(featurePlans, eq(orders.planId, featurePlans.id))
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(and(eq(orders.id, orderId), isNull(users.deletedAt)))
    .limit(1);

  if (!row) return false;

  const message = await paymentReceiptEmail({
    to: row.email,
    eventName: row.eventName ?? '',
    planName: row.planName,
    amount: formatCurrency(row.totalMinor, row.currency, row.locale),
    url: row.eventId
      ? appUrl(`/app/dogadjaji/${row.eventId}/naplata`)
      : appUrl('/app/dogadjaji'),
    locale: row.locale,
  });

  const result = await getEmailAdapter().send(message);
  return result.ok;
}
