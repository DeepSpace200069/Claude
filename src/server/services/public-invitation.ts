import 'server-only';

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { unstable_cache as cache, updateTag } from 'next/cache';

import { documentFromRecords, type EditorDocument } from '@/features/editor/document';
import type { EventDetails } from '@/features/events/details';
import type { InvitationRenderContext } from '@/features/sections/types';
import type { Locale } from '@/i18n/config';
import { hashToken, safeCompare } from '@/lib/ids';
import { db } from '@/server/db';
import {
  eventTypes,
  events,
  invitationRecipients,
  invitationSections,
  invitationViewStats,
  invitations,
} from '@/server/db/schema';

import { resolveMediaByIds } from './media';

/**
 * Čitanje javne pozivnice (zahtev 21, 22 i 23).
 *
 * Odvojeno od `services/invitations.ts` namerno. Uređivač čita **sve** što
 * organizatoru treba; javna stranica sme da vidi samo ono što gost sme da vidi.
 * Kada su dve stvari u istoj funkciji, pre ili kasnije neko doda polje koje
 * procuri na javnu stranicu.
 */

/** Koliko dugo se sadržaj pozivnice drži u kešu bez ponovnog upita. */
export const PUBLIC_CACHE_SECONDS = 300;

/** Oznaka keša za jednu pozivnicu; koristi je invalidacija posle izmene. */
export function invitationCacheTag(slug: string): string {
  return `pozivnica:${slug}`;
}

/**
 * Poziva se posle svake izmene ili promene statusa pozivnice.
 *
 * `updateTag`, a ne `revalidateTag`: prvi odmah poništava keš i garantuje da
 * sledeće čitanje vidi upravo sačuvano stanje, dok bi drugi sadržaj samo
 * označio kao zastareo i pustio da se osveži u pozadini. Organizatoru koji je
 * sačuvao izmenu i odmah otvorio javni link to ne bi bilo prihvatljivo.
 *
 * Zove se iz server akcija - jedino tamo `updateTag` ima smisla.
 */
export function revalidateInvitation(slug: string): void {
  try {
    updateTag(invitationCacheTag(slug));
  } catch (error) {
    // Van Next zahteva keša ni nema, pa nema ni šta da se poništi. Servis se
    // koristi i iz skripti, gde ovo ne sme da obori upis u bazu.
    if (!isMissingCacheContext(error)) throw error;
  }
}

export type PublicInvitation = {
  invitationId: string;
  eventId: string;
  slug: string;
  status: 'draft' | 'published' | 'unpublished';
  privacy: 'public' | 'unlisted' | 'pin' | 'invite_only';
  hasPin: boolean;
  expiresAt: Date | null;
  title: string;
  summary: string;
  share: {
    title: string | null;
    description: string | null;
    imageUrl: string | null;
  };
  locale: Locale;
  document: EditorDocument;
  context: InvitationRenderContext;
  eventTypeKey: string;
  startsAt: Date | null;
  timeZone: string;
};

/**
 * Sadržaj pozivnice iz baze, keširan po slugu.
 *
 * Keš je vezan za oznaku (`cacheTag`), a ne za vreme: izmena u uređivaču odmah
 * poništava keš, pa gost nikad ne vidi stariju verziju od one koju je
 * organizator upravo sačuvao (zahtev 4.7). Vreme je samo gornja granica.
 *
 * Namerno se **ne** keširaju odluke o pristupu (PIN, istek, token): one zavise
 * od zahteva i moraju da se računaju iznova.
 */
async function loadInvitation(slug: string): Promise<PublicInvitation | null> {
  const [row] = await db
    .select({
      invitationId: invitations.id,
      eventId: events.id,
      slug: invitations.publicSlug,
      status: invitations.status,
      privacy: invitations.privacy,
      pinHash: invitations.pinHash,
      expiresAt: invitations.expiresAt,
      title: invitations.title,
      summary: invitations.summary,
      shareTitle: invitations.shareTitle,
      shareDescription: invitations.shareDescription,
      shareImageUrl: invitations.shareImageUrl,
      themeTokens: invitations.themeTokens,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
      city: events.city,
      venueName: events.venueName,
      details: events.details,
      primaryLocale: events.primaryLocale,
      eventTypeKey: eventTypes.key,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
    .where(
      and(
        eq(invitations.publicSlug, slug),
        isNull(events.deletedAt),
        isNull(invitations.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  const sectionRows = await db
    .select({
      id: invitationSections.id,
      type: invitationSections.type,
      schemaVersion: invitationSections.schemaVersion,
      position: invitationSections.position,
      isVisible: invitationSections.isVisible,
      data: invitationSections.data,
    })
    .from(invitationSections)
    .where(eq(invitationSections.invitationId, row.invitationId))
    .orderBy(asc(invitationSections.position));

  const document = documentFromRecords(row.themeTokens, sectionRows, (id, message) => {
    console.warn(`[pozivnica ${slug}] Sekcija ${id} je preskočena: ${message}`);
  });

  const media = await resolveMediaByIds(collectAssetIds(document));

  return {
    invitationId: row.invitationId,
    eventId: row.eventId,
    slug: row.slug,
    status: row.status,
    privacy: row.privacy,
    // Sam heš PIN-a nikad ne izlazi iz ovog modula - napolje ide samo podatak
    // da PIN postoji.
    hasPin: row.pinHash !== null,
    expiresAt: row.expiresAt,
    title: row.title,
    summary: row.summary,
    share: {
      title: row.shareTitle,
      description: row.shareDescription,
      imageUrl: row.shareImageUrl,
    },
    locale: row.primaryLocale,
    document,
    eventTypeKey: row.eventTypeKey,
    startsAt: row.startsAt,
    timeZone: row.timeZone,
    context: {
      mode: 'live',
      eventTypeKey: row.eventTypeKey,
      startsAt: row.startsAt?.toISOString() ?? null,
      timeZone: row.timeZone,
      city: row.city,
      venueName: row.venueName,
      details: row.details as EventDetails as Record<string, unknown>,
      media,
      /*
       * Interaktivni deo namerno **nije** keširan: zavisi od gosta (njegov
       * token, njegov raniji odgovor) i od trenutka (ključ forme). Dodaje ga
       * stranica pri svakom zahtevu.
       */
      live: null,
    },
  };
}

/**
 * Pozivnica po slugu, keširana kada je keš dostupan.
 *
 * `unstable_cache` radi samo unutar Next zahteva - van njega (seed skripta,
 * zakazani posao, testovi) baca `Invariant: incrementalCache missing`. Keš je
 * ubrzanje, a ne uslov ispravnosti, pa u tom slučaju čitamo direktno iz baze
 * umesto da pukne poziv.
 *
 * Prepoznavanje ide po poruci, što jeste vezano za verziju Next-a. Ako se
 * poruka promeni, greška se **prosleđuje dalje** i odmah je vidljiva u
 * testovima - bolje nego da tiho izgubimo keširanje u produkciji.
 */
export async function getPublicInvitation(
  slug: string,
): Promise<PublicInvitation | null> {
  try {
    return await cache(loadInvitation, ['javna-pozivnica'], {
      tags: [invitationCacheTag(slug)],
      revalidate: PUBLIC_CACHE_SECONDS,
    })(slug);
  } catch (error) {
    if (!isMissingCacheContext(error)) throw error;
    return loadInvitation(slug);
  }
}

function isMissingCacheContext(error: unknown): boolean {
  return error instanceof Error && error.message.includes('incrementalCache');
}

/**
 * Skuplja sve `assetId` vrednosti iz sekcija.
 *
 * Prolazak kroz podatke je generički umesto po tipu sekcije: nova sekcija sa
 * fotografijom radi bez izmene ovog koda, a jedan upit razrešava sve slike
 * odjednom (bez N+1, zahtev 32).
 */
function collectAssetIds(document: EditorDocument): string[] {
  const ids: string[] = [];

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== 'object' || value === null) return;

    const record = value as Record<string, unknown>;
    if (typeof record.assetId === 'string') ids.push(record.assetId);
    for (const nested of Object.values(record)) walk(nested);
  };

  for (const section of document.sections) walk(section.data);
  return [...new Set(ids)];
}

// --- Pristup ----------------------------------------------------------------

export type AccessRequest = {
  slug: string;
  /** PIN unet u formi, ako je upravo poslat. */
  pin?: string | null;
  /** Dokaz da je PIN već unet u ovoj sesiji (iz kolačića). */
  pinProof?: string | null;
  /** Token iz personalizovanog linka `/p/<slug>/<token>`. */
  recipientToken?: string | null;
  now?: Date;
};

export type AccessResult =
  | { state: 'ok'; invitation: PublicInvitation; greetingName: string | null }
  | { state: 'not_found' }
  | { state: 'not_published' }
  | { state: 'expired'; expiresAt: Date }
  | { state: 'pin_required'; invitation: PublicInvitation; wrongPin: boolean }
  | { state: 'invite_only' };

/**
 * Da li gost sme da vidi pozivnicu (zahtev 23).
 *
 * Redosled provera je namerno ovakav: prvo postojanje, pa objavljenost, pa
 * istek, pa tek onda privatnost. Tako neobjavljena pozivnica sa PIN-om ne
 * traži PIN - jer ni sa tačnim PIN-om ne bi imala šta da prikaže.
 */
export async function resolvePublicAccess(
  request: AccessRequest,
): Promise<AccessResult> {
  const invitation = await getPublicInvitation(request.slug);
  if (!invitation) return { state: 'not_found' };

  if (invitation.status !== 'published') return { state: 'not_published' };

  const now = request.now ?? new Date();
  if (invitation.expiresAt && invitation.expiresAt.getTime() <= now.getTime()) {
    return { state: 'expired', expiresAt: invitation.expiresAt };
  }

  if (invitation.privacy === 'invite_only') {
    const recipient = request.recipientToken
      ? await findRecipient(invitation.invitationId, request.recipientToken)
      : null;

    if (!recipient) return { state: 'invite_only' };
    return { state: 'ok', invitation, greetingName: recipient.greetingName };
  }

  if (invitation.privacy === 'pin' && invitation.hasPin) {
    const unlocked =
      (request.pinProof !== null &&
        request.pinProof !== undefined &&
        (await isValidPinProof(invitation.invitationId, request.pinProof))) ||
      (typeof request.pin === 'string' &&
        request.pin.length > 0 &&
        (await isCorrectPin(invitation.invitationId, request.pin)));

    if (!unlocked) {
      return {
        state: 'pin_required',
        invitation,
        wrongPin: typeof request.pin === 'string' && request.pin.length > 0,
      };
    }
  }

  // Personalizovani link radi i kad pozivnica nije ograničena na njega:
  // pozdrav po imenu je tada dodatak, a ne uslov pristupa.
  const recipient = request.recipientToken
    ? await findRecipient(invitation.invitationId, request.recipientToken)
    : null;

  return { state: 'ok', invitation, greetingName: recipient?.greetingName ?? null };
}

async function findRecipient(
  invitationId: string,
  token: string,
): Promise<{ id: string; greetingName: string | null } | null> {
  const [recipient] = await db
    .select({
      id: invitationRecipients.id,
      greetingName: invitationRecipients.greetingName,
    })
    .from(invitationRecipients)
    .where(
      and(
        eq(invitationRecipients.invitationId, invitationId),
        // Token se u bazi čuva isključivo kao heš; poređenje ide po hešu, pa
        // ni sadržaj baze ne otkriva linkove poslate gostima (zahtev 39.6).
        eq(invitationRecipients.tokenHash, hashToken(token)),
        isNull(invitationRecipients.revokedAt),
      ),
    )
    .limit(1);

  return recipient ?? null;
}

// --- PIN --------------------------------------------------------------------

/**
 * Provera PIN-a.
 *
 * PIN se čuva kao SHA-256 heš i poredi funkcijom otpornom na merenje vremena.
 * Nije lozinka naloga nego kratka zajednička šifra za goste, pa `bcrypt` ovde
 * ne bi doneo ništa osim sporije stranice - stvarna odbrana od pogađanja je
 * ograničenje broja pokušaja u server akciji.
 */
async function readPinHash(invitationId: string): Promise<string | null> {
  const [row] = await db
    .select({ pinHash: invitations.pinHash })
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  return row?.pinHash ?? null;
}

export async function isCorrectPin(
  invitationId: string,
  pin: string,
): Promise<boolean> {
  const stored = await readPinHash(invitationId);
  if (!stored) return false;
  return safeCompare(stored, hashToken(pin.trim()));
}

/**
 * Dokaz da je PIN već unet, koji se čuva u kolačiću.
 *
 * Namerno **nije** sam PIN: kolačić koji nosi PIN u čitljivom obliku bi ga
 * odao svakome ko dođe do uređaja. Dokaz je izveden iz heša PIN-a, pa promena
 * PIN-a automatski poništava sve ranije otključane sesije.
 */
export async function makePinProof(invitationId: string): Promise<string | null> {
  const stored = await readPinHash(invitationId);
  return stored ? hashToken(`${invitationId}:${stored}`) : null;
}

async function isValidPinProof(
  invitationId: string,
  proof: string,
): Promise<boolean> {
  const expected = await makePinProof(invitationId);
  return expected !== null && safeCompare(expected, proof);
}

// --- Statistika -------------------------------------------------------------

/**
 * Dnevni agregat pregleda (zahtev 27).
 *
 * Čuva se samo broj po danu - nikad IP adresa, korisnički agent ni bilo šta po
 * čemu bi se gost mogao prepoznati. Dan se računa u vremenskoj zoni događaja,
 * jer organizator gleda statistiku u svom vremenu, a ne u UTC-u.
 */
export async function recordInvitationView(input: {
  invitationId: string;
  timeZone: string;
  isFirstVisit: boolean;
  now?: Date;
}): Promise<void> {
  const day = formatDayInZone(input.now ?? new Date(), input.timeZone);

  await db
    .insert(invitationViewStats)
    .values({
      invitationId: input.invitationId,
      day,
      views: 1,
      uniqueVisitors: input.isFirstVisit ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [invitationViewStats.invitationId, invitationViewStats.day],
      set: {
        views: sql`${invitationViewStats.views} + 1`,
        uniqueVisitors: sql`${invitationViewStats.uniqueVisitors} + ${input.isFirstVisit ? 1 : 0}`,
        updatedAt: new Date(),
      },
    });
}

export async function recordInvitationShare(input: {
  invitationId: string;
  timeZone: string;
  now?: Date;
}): Promise<void> {
  const day = formatDayInZone(input.now ?? new Date(), input.timeZone);

  await db
    .insert(invitationViewStats)
    .values({ invitationId: input.invitationId, day, shares: 1 })
    .onConflictDoUpdate({
      target: [invitationViewStats.invitationId, invitationViewStats.day],
      set: {
        shares: sql`${invitationViewStats.shares} + 1`,
        updatedAt: new Date(),
      },
    });
}

export type ViewStats = {
  today: number;
  total: number;
  unique: number;
  shares: number;
};

/**
 * Zbirna statistika koju vidi organizator.
 *
 * Sabira se u bazi, a ne u aplikaciji: broj dana raste sa vremenom, pa bi
 * učitavanje svih redova pre ili kasnije postalo besmisleno.
 */
export async function getInvitationStats(
  invitationId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<ViewStats> {
  const today = formatDayInZone(now, timeZone);

  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${invitationViewStats.views}), 0)::int`,
      unique: sql<number>`coalesce(sum(${invitationViewStats.uniqueVisitors}), 0)::int`,
      shares: sql<number>`coalesce(sum(${invitationViewStats.shares}), 0)::int`,
      today: sql<number>`coalesce(sum(case when ${invitationViewStats.day} = ${today} then ${invitationViewStats.views} else 0 end), 0)::int`,
    })
    .from(invitationViewStats)
    .where(eq(invitationViewStats.invitationId, invitationId));

  return {
    today: row?.today ?? 0,
    total: row?.total ?? 0,
    unique: row?.unique ?? 0,
    shares: row?.shares ?? 0,
  };
}

/** `GGGG-MM-DD` u zadatoj vremenskoj zoni, bez zavisnosti od zone servera. */
export function formatDayInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Neispravna zona ne sme da obori beleženje pregleda.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}
