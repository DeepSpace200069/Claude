import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { can } from '@/features/billing/entitlements';
import type { PrivacySettingsInput } from '@/features/invitations/schemas';
import { hashToken } from '@/lib/ids';
import { db } from '@/server/db';
import { events, invitations } from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/authz/errors';

import { getUserEntitlements } from './entitlements';

/**
 * Objavljivanje i privatnost pozivnice (zahtev 21 i 23).
 *
 * Objavljivanje je vezano za pravo `publish` iz paketa. Na besplatnom paketu se
 * **ne** dešava ništa što bi ličilo na uspeh - vraća se jasna greška sa
 * razlogom. Tok narudžbine i plaćanja dolazi u Fazi 7; do tada plaćen paket
 * evidentira administrator, kao što i sam adapter naplate predviđa.
 */

export type PublicationState = {
  invitationId: string;
  slug: string;
  status: 'draft' | 'published' | 'unpublished';
  privacy: PrivacySettingsInput['privacy'];
  hasPin: boolean;
  expiresAt: Date | null;
  publishedAt: Date | null;
  shareTitle: string | null;
  shareDescription: string | null;
  canPublish: boolean;
  planName: string;
};

export async function getPublicationState(
  eventId: string,
  userId: string,
): Promise<PublicationState | null> {
  const [row] = await db
    .select({
      invitationId: invitations.id,
      slug: invitations.publicSlug,
      status: invitations.status,
      privacy: invitations.privacy,
      pinHash: invitations.pinHash,
      expiresAt: invitations.expiresAt,
      publishedAt: invitations.publishedAt,
      shareTitle: invitations.shareTitle,
      shareDescription: invitations.shareDescription,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!row) return null;

  const entitlements = await getUserEntitlements(userId);

  return {
    invitationId: row.invitationId,
    slug: row.slug,
    status: row.status,
    privacy: row.privacy,
    hasPin: row.pinHash !== null,
    expiresAt: row.expiresAt,
    publishedAt: row.publishedAt,
    shareTitle: row.shareTitle,
    shareDescription: row.shareDescription,
    canPublish: can(entitlements, 'publish'),
    planName: entitlements.planName,
  };
}

/**
 * Izmena privatnosti, isteka i podataka za link preview karticu.
 *
 * Prazan PIN znači „ne diraj postojeći”, a ne „obriši ga": korisnik koji menja
 * samo datum isteka ne bi očekivao da mu PIN nestane. Brisanje PIN-a se dešava
 * prelaskom na drugi režim privatnosti.
 */
export async function updateInvitationPrivacy(
  input: PrivacySettingsInput,
): Promise<{ slug: string }> {
  const [current] = await db
    .select({
      id: invitations.id,
      slug: invitations.publicSlug,
      pinHash: invitations.pinHash,
      timeZone: events.timeZone,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .where(and(eq(events.id, input.eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!current) throw new NotFoundError('Pozivnica ne postoji.');

  const nextPinHash =
    input.privacy === 'pin'
      ? input.pin
        ? hashToken(input.pin)
        : current.pinHash
      : null;

  if (input.privacy === 'pin' && !nextPinHash) {
    throw new ValidationError('Za zaštitu PIN-om unesite PIN.', {
      pin: ['Unesite PIN od 4 do 8 cifara.'],
    });
  }

  await db
    .update(invitations)
    .set({
      privacy: input.privacy,
      pinHash: nextPinHash,
      // Pozivnica važi do kraja izabranog dana u vremenskoj zoni događaja -
      // gost koji je otvori uveče na sam datum isteka mora da je vidi.
      expiresAt: input.expiresOn
        ? endOfDayInZone(input.expiresOn, current.timeZone)
        : null,
      shareTitle: input.shareTitle || null,
      shareDescription: input.shareDescription || null,
    })
    .where(eq(invitations.id, current.id));

  return { slug: current.slug };
}

export async function publishInvitation(
  eventId: string,
  userId: string,
): Promise<{ slug: string }> {
  const state = await getPublicationState(eventId, userId);
  if (!state) throw new NotFoundError('Pozivnica ne postoji.');

  if (!state.canPublish) {
    throw new ValidationError(
      `Paket „${state.planName}” ne uključuje objavljivanje javnog linka.`,
      { plan: ['Nadogradite paket da biste objavili pozivnicu.'] },
    );
  }

  if (state.privacy === 'pin' && !state.hasPin) {
    throw new ValidationError('Pozivnica je zaštićena PIN-om, ali PIN nije zadat.', {
      pin: ['Unesite PIN pre objavljivanja.'],
    });
  }

  await db
    .update(invitations)
    .set({
      status: 'published',
      publishedAt: state.publishedAt ?? new Date(),
      unpublishedAt: null,
    })
    .where(eq(invitations.id, state.invitationId));

  return { slug: state.slug };
}

/**
 * Ručno deaktiviranje (zahtev 4.3).
 *
 * Sadržaj ostaje netaknut, samo javni link prestaje da radi. Slug se ne
 * oslobađa - ponovno objavljivanje mora da vrati **isti** link, jer je već
 * podeljen gostima.
 */
export async function unpublishInvitation(
  eventId: string,
): Promise<{ slug: string }> {
  const [current] = await db
    .select({ id: invitations.id, slug: invitations.publicSlug })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);

  if (!current) throw new NotFoundError('Pozivnica ne postoji.');

  await db
    .update(invitations)
    .set({ status: 'unpublished', unpublishedAt: new Date() })
    .where(eq(invitations.id, current.id));

  return { slug: current.slug };
}

/**
 * Kraj zadatog dana u vremenskoj zoni događaja, kao trenutak u UTC-u.
 *
 * Računa se pomeraj zone na taj datum (`Intl` daje pomeraj koji važi tada, pa
 * letnje/zimsko računanje vremena ne pravi grešku od sat vremena).
 */
export function endOfDayInZone(isoDate: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) throw new ValidationError('Neispravan datum isteka.');

  // Ponoć sledećeg dana, minus jedna sekunda.
  const naiveUtc = Date.UTC(year, month - 1, day, 23, 59, 59);
  const offset = zoneOffsetMs(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offset);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === '24' ? '0' : parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );

    return asUtc - instant.getTime();
  } catch {
    return 0;
  }
}
