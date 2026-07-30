import 'server-only';

import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { validateAnswers, type RsvpQuestionInput } from '@/features/rsvp/schemas';
import type {
  ExistingRsvp,
  RsvpAnswerValue,
  RsvpQuestion,
  RsvpQuestionOption,
  RsvpStatus,
} from '@/features/rsvp/types';
import { RECIPIENT_TOKEN_LENGTH, hashToken, randomToken } from '@/lib/ids';
import { db } from '@/server/db';
import {
  guestHouseholds,
  guests,
  invitationRecipients,
  invitations,
  rsvpAnswers,
  rsvpQuestions,
  rsvpResponses,
} from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/authz/errors';

/**
 * Potvrda dolaska (zahtev 12 i 13).
 *
 * Odgovor gosta je jedini upis u aplikaciji koji stiže od nekoga ko nema nalog.
 * Zbog toga ovde ništa ne veruje ulazu: pozivnica se traži po slugu, primalac
 * po hešu tokena, a dodatna pitanja se učitavaju iz baze pa se odgovori mere
 * prema njima - a ne prema onome što je klijent poslao (zahtev 24 i 39.6).
 */

// --- Dodatna pitanja --------------------------------------------------------

export async function listRsvpQuestions(
  invitationId: string,
): Promise<RsvpQuestion[]> {
  const rows = await db
    .select({
      id: rsvpQuestions.id,
      type: rsvpQuestions.type,
      label: rsvpQuestions.label,
      helpText: rsvpQuestions.helpText,
      isRequired: rsvpQuestions.isRequired,
      attendingOnly: rsvpQuestions.attendingOnly,
      position: rsvpQuestions.position,
      config: rsvpQuestions.config,
    })
    .from(rsvpQuestions)
    .where(eq(rsvpQuestions.invitationId, invitationId))
    .orderBy(asc(rsvpQuestions.position), asc(rsvpQuestions.createdAt));

  return rows;
}

/** Pozivnica događaja - svaki događaj ima tačno jednu. */
export async function requireInvitationId(
  eventId: string,
): Promise<{ invitationId: string; slug: string }> {
  const [row] = await db
    .select({ id: invitations.id, slug: invitations.publicSlug })
    .from(invitations)
    .where(and(eq(invitations.eventId, eventId), isNull(invitations.deletedAt)))
    .limit(1);

  if (!row) throw new NotFoundError('Pozivnica ne postoji.');
  return { invitationId: row.id, slug: row.slug };
}

export async function listRsvpQuestionsForEvent(
  eventId: string,
): Promise<RsvpQuestion[]> {
  const { invitationId } = await requireInvitationId(eventId);
  return listRsvpQuestions(invitationId);
}

/**
 * Ključevi opcija se dodeljuju jednom i više se ne menjaju.
 *
 * Organizator sme da preformuliše opciju („Pileće" → „Piletina"), a odgovori
 * koji su već stigli moraju da nastave da pokazuju na istu stvar. Zato se novi
 * ključ traži tek za opciju koja ga nema, i to iznad najvišeg iskorišćenog.
 */
function assignOptionValues(
  incoming: ReadonlyArray<{ value: string; label: string }>,
  existing: readonly RsvpQuestionOption[],
): RsvpQuestionOption[] {
  const known = new Set(existing.map((option) => option.value));
  let next =
    existing.reduce((max, option) => {
      const parsed = Number.parseInt(option.value.replace(/^o/, ''), 10);
      return Number.isFinite(parsed) && parsed > max ? parsed : max;
    }, 0) + 1;

  return incoming.map((option) => {
    if (option.value && known.has(option.value)) {
      return { value: option.value, label: option.label };
    }
    const value = `o${next}`;
    next += 1;
    return { value, label: option.label };
  });
}

function toConfig(
  input: RsvpQuestionInput,
  existing: readonly RsvpQuestionOption[],
): RsvpQuestion['config'] {
  const config: RsvpQuestion['config'] = {};

  if (input.type === 'single_choice' || input.type === 'multi_choice') {
    config.options = assignOptionValues(input.options, existing);
  }
  if (input.type === 'number') {
    if (input.min !== '') config.min = input.min;
    if (input.max !== '') config.max = input.max;
  }
  if (input.type === 'text' && input.maxLength !== '') {
    config.maxLength = input.maxLength;
  }

  return config;
}

export async function createRsvpQuestion(
  eventId: string,
  input: RsvpQuestionInput,
): Promise<{ questionId: string }> {
  const { invitationId } = await requireInvitationId(eventId);

  const [last] = await db
    .select({ position: rsvpQuestions.position })
    .from(rsvpQuestions)
    .where(eq(rsvpQuestions.invitationId, invitationId))
    .orderBy(desc(rsvpQuestions.position))
    .limit(1);

  const [created] = await db
    .insert(rsvpQuestions)
    .values({
      invitationId,
      type: input.type,
      label: input.label,
      helpText: input.helpText || null,
      isRequired: input.isRequired,
      attendingOnly: input.attendingOnly,
      position: (last?.position ?? -1) + 1,
      config: toConfig(input, []),
    })
    .returning({ id: rsvpQuestions.id });

  if (!created) throw new Error('Pitanje nije napravljeno.');
  return { questionId: created.id };
}

export async function updateRsvpQuestion(
  eventId: string,
  questionId: string,
  input: RsvpQuestionInput,
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);

  const [current] = await db
    .select({ config: rsvpQuestions.config })
    .from(rsvpQuestions)
    .where(
      and(
        eq(rsvpQuestions.id, questionId),
        eq(rsvpQuestions.invitationId, invitationId),
      ),
    )
    .limit(1);

  if (!current) throw new NotFoundError('Pitanje ne postoji.');

  await db
    .update(rsvpQuestions)
    .set({
      type: input.type,
      label: input.label,
      helpText: input.helpText || null,
      isRequired: input.isRequired,
      attendingOnly: input.attendingOnly,
      config: toConfig(input, current.config.options ?? []),
    })
    .where(
      and(
        eq(rsvpQuestions.id, questionId),
        eq(rsvpQuestions.invitationId, invitationId),
      ),
    );
}

/**
 * Brisanje pitanja briše i odgovore na njega (`ON DELETE CASCADE`).
 *
 * To je namerno: odgovor bez pitanja nema značenje, a ostao bi u izvozu kao
 * kolona bez zaglavlja.
 */
export async function deleteRsvpQuestion(
  eventId: string,
  questionId: string,
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);

  const deleted = await db
    .delete(rsvpQuestions)
    .where(
      and(
        eq(rsvpQuestions.id, questionId),
        eq(rsvpQuestions.invitationId, invitationId),
      ),
    )
    .returning({ id: rsvpQuestions.id });

  if (deleted.length === 0) throw new NotFoundError('Pitanje ne postoji.');
}

export async function reorderRsvpQuestions(
  eventId: string,
  questionIds: readonly string[],
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);
  if (questionIds.length === 0) return;

  await db.transaction(async (tx) => {
    for (const [index, questionId] of questionIds.entries()) {
      await tx
        .update(rsvpQuestions)
        .set({ position: index })
        .where(
          and(
            eq(rsvpQuestions.id, questionId),
            eq(rsvpQuestions.invitationId, invitationId),
          ),
        );
    }
  });
}

// --- Primalac i postojeći odgovor -------------------------------------------

export type RecipientContext = {
  id: string;
  greetingName: string | null;
  maxGuests: number | null;
  guestId: string | null;
  householdId: string | null;
};

export async function findRecipientByToken(
  invitationId: string,
  token: string,
): Promise<RecipientContext | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      id: invitationRecipients.id,
      greetingName: invitationRecipients.greetingName,
      maxGuests: invitationRecipients.maxGuests,
      guestId: invitationRecipients.guestId,
      householdId: invitationRecipients.householdId,
    })
    .from(invitationRecipients)
    .where(
      and(
        eq(invitationRecipients.invitationId, invitationId),
        eq(invitationRecipients.tokenHash, hashToken(token)),
        isNull(invitationRecipients.revokedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Beleži da je lični link otvoren - organizator vidi ko još nije ni pogledao. */
export async function recordRecipientOpen(recipientId: string): Promise<void> {
  await db
    .update(invitationRecipients)
    .set({
      lastOpenedAt: new Date(),
      openCount: sql`${invitationRecipients.openCount} + 1`,
    })
    .where(eq(invitationRecipients.id, recipientId));
}

async function loadAnswers(
  responseId: string,
): Promise<Record<string, RsvpAnswerValue>> {
  const rows = await db
    .select({ questionId: rsvpAnswers.questionId, value: rsvpAnswers.value })
    .from(rsvpAnswers)
    .where(eq(rsvpAnswers.responseId, responseId));

  return Object.fromEntries(rows.map((row) => [row.questionId, row.value]));
}

function toExisting(row: {
  status: RsvpStatus;
  fullName: string;
  email: string | null;
  phone: string | null;
  adultsCount: number;
  childrenCount: number;
  companions: string[];
  message: string | null;
  submittedAt: Date;
  lastEditedAt: Date | null;
}): Omit<ExistingRsvp, 'answers'> {
  return {
    status: row.status,
    fullName: row.fullName,
    email: row.email ?? '',
    phone: row.phone ?? '',
    adultsCount: row.adultsCount,
    childrenCount: row.childrenCount,
    companions: row.companions,
    message: row.message ?? '',
    submittedAt: row.submittedAt.toISOString(),
    lastEditedAt: row.lastEditedAt?.toISOString() ?? null,
  };
}

const RESPONSE_COLUMNS = {
  id: rsvpResponses.id,
  status: rsvpResponses.status,
  fullName: rsvpResponses.fullName,
  email: rsvpResponses.email,
  phone: rsvpResponses.phone,
  adultsCount: rsvpResponses.adultsCount,
  childrenCount: rsvpResponses.childrenCount,
  companions: rsvpResponses.companions,
  message: rsvpResponses.message,
  submittedAt: rsvpResponses.submittedAt,
  lastEditedAt: rsvpResponses.lastEditedAt,
} as const;

export async function loadResponseForRecipient(
  recipientId: string,
): Promise<ExistingRsvp | null> {
  const [row] = await db
    .select(RESPONSE_COLUMNS)
    .from(rsvpResponses)
    .where(eq(rsvpResponses.recipientId, recipientId))
    .limit(1);

  if (!row) return null;
  return { ...toExisting(row), answers: await loadAnswers(row.id) };
}

/**
 * Odgovor po tokenu za izmenu (zahtev 5, gost).
 *
 * Token je jedini dokaz da je to isti gost, pa se traži po hešu i uvek u okviru
 * jedne pozivnice - tuđi token ne sme da otvori odgovor na drugoj pozivnici.
 */
export async function loadResponseByEditToken(
  invitationId: string,
  editToken: string,
): Promise<(ExistingRsvp & { responseId: string }) | null> {
  if (!editToken) return null;

  const [row] = await db
    .select(RESPONSE_COLUMNS)
    .from(rsvpResponses)
    .where(
      and(
        eq(rsvpResponses.invitationId, invitationId),
        eq(rsvpResponses.editTokenHash, hashToken(editToken)),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    ...toExisting(row),
    answers: await loadAnswers(row.id),
    responseId: row.id,
  };
}

// --- Slanje odgovora --------------------------------------------------------

export type SubmitRsvpInput = {
  invitationId: string;
  recipient: RecipientContext | null;
  /** Postojeći odgovor kada gost menja preko linka za izmenu. */
  responseId: string | null;
  fullName: string;
  email: string;
  phone: string;
  status: 'yes' | 'no' | 'maybe';
  adultsCount: number;
  childrenCount: number;
  companions: string[];
  message: string;
  answers: Record<string, unknown>;
};

export type SubmitRsvpResult = {
  responseId: string;
  /** Vraća se **samo** kada je token upravo napravljen. */
  editToken: string | null;
  status: 'yes' | 'no' | 'maybe';
  isUpdate: boolean;
};

/**
 * Upis odgovora.
 *
 * Isti primalac uvek ima najviše jedan odgovor: ponovno slanje sa istog ličnog
 * linka **menja** postojeći umesto da napravi drugi (jedinstveni indeks u bazi
 * to i garantuje). Zato dvostruki klik na „Pošalji" ne pravi dva gosta.
 */
export async function submitRsvp(
  input: SubmitRsvpInput,
): Promise<SubmitRsvpResult> {
  const questions = await listRsvpQuestions(input.invitationId);
  const validation = validateAnswers(questions, input.answers, input.status);

  if (Object.keys(validation.errors).length > 0) {
    throw new ValidationError('Proverite odgovore na dodatna pitanja.', validation.errors);
  }

  const limit = input.recipient?.maxGuests ?? null;
  const total = input.status === 'yes' ? input.adultsCount + input.childrenCount : 0;

  if (limit !== null && total > limit) {
    throw new ValidationError('Broj gostiju je veći od onoga za koliko je link izdat.', {
      adultsCount: [`Ovaj link važi za najviše ${limit} osoba.`],
    });
  }

  const existingId = await resolveExistingResponseId(input);
  const editToken = existingId ? null : randomToken(RECIPIENT_TOKEN_LENGTH);

  const values = {
    invitationId: input.invitationId,
    recipientId: input.recipient?.id ?? null,
    householdId: input.recipient?.householdId ?? null,
    fullName: input.fullName,
    email: input.email || null,
    phone: input.phone || null,
    status: input.status,
    adultsCount: input.status === 'yes' ? input.adultsCount : 0,
    childrenCount: input.status === 'yes' ? input.childrenCount : 0,
    companions: input.status === 'yes' ? input.companions.filter(Boolean) : [],
    message: input.message || null,
  };

  const responseId = await db.transaction(async (tx) => {
    let id: string;

    if (existingId) {
      const [updated] = await tx
        .update(rsvpResponses)
        .set({ ...values, lastEditedAt: new Date() })
        .where(eq(rsvpResponses.id, existingId))
        .returning({ id: rsvpResponses.id });

      if (!updated) throw new NotFoundError('Odgovor ne postoji.');
      id = updated.id;
    } else {
      const [created] = await tx
        .insert(rsvpResponses)
        .values({ ...values, editTokenHash: hashToken(editToken as string) })
        .returning({ id: rsvpResponses.id });

      if (!created) throw new Error('Odgovor nije upisan.');
      id = created.id;
    }

    /*
     * Odgovori na dodatna pitanja se pišu iznova: gost koji je promenio „ne
     * dolazim" u „dolazim" mora da dobije nova pitanja, a stara koja se više ne
     * prikazuju ne smeju da ostanu kao njegov odgovor.
     */
    await tx.delete(rsvpAnswers).where(eq(rsvpAnswers.responseId, id));

    const rows = Object.entries(validation.values).map(([questionId, value]) => ({
      responseId: id,
      questionId,
      value,
    }));

    if (rows.length > 0) await tx.insert(rsvpAnswers).values(rows);

    return id;
  });

  return {
    responseId,
    editToken,
    status: input.status,
    isUpdate: existingId !== null,
  };
}

/**
 * Nalazi odgovor koji se menja.
 *
 * Prednost ima izričito zadat `responseId` (gost je došao preko linka za
 * izmenu), pa tek onda lični link. Javni RSVP bez ijednog od to dvoje uvek
 * pravi nov odgovor - dva gosta sa istim imenom su realnost, a spajanje po
 * imenu bi tiho prepisalo tuđu potvrdu.
 */
async function resolveExistingResponseId(
  input: SubmitRsvpInput,
): Promise<string | null> {
  if (input.responseId) return input.responseId;
  if (!input.recipient) return null;

  const [row] = await db
    .select({ id: rsvpResponses.id })
    .from(rsvpResponses)
    .where(eq(rsvpResponses.recipientId, input.recipient.id))
    .limit(1);

  return row?.id ?? null;
}

// --- Pregled za organizatora ------------------------------------------------

export type ResponseRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: RsvpStatus;
  adultsCount: number;
  childrenCount: number;
  companions: string[];
  message: string | null;
  submittedAt: Date;
  lastEditedAt: Date | null;
  /** Ime iz spiska gostiju, kada je odgovor stigao preko ličnog linka. */
  guestName: string | null;
  householdName: string | null;
  answers: Record<string, RsvpAnswerValue>;
};

export type ResponseFilters = {
  odgovor: 'svi' | 'yes' | 'no' | 'maybe';
  pretraga?: string | undefined;
  redosled: 'najnoviji' | 'ime';
};

export async function listRsvpResponses(
  eventId: string,
  filters: ResponseFilters,
): Promise<ResponseRow[]> {
  const { invitationId } = await requireInvitationId(eventId);

  const conditions = [eq(rsvpResponses.invitationId, invitationId)];

  if (filters.odgovor !== 'svi') {
    conditions.push(eq(rsvpResponses.status, filters.odgovor));
  }

  if (filters.pretraga) {
    const pattern = `%${filters.pretraga}%`;
    const search = or(
      sql`${rsvpResponses.fullName} ilike ${pattern}`,
      sql`${rsvpResponses.email} ilike ${pattern}`,
      sql`${rsvpResponses.message} ilike ${pattern}`,
    );
    if (search) conditions.push(search);
  }

  const rows = await db
    .select({
      ...RESPONSE_COLUMNS,
      guestFirstName: guests.firstName,
      guestLastName: guests.lastName,
      householdName: guestHouseholds.name,
    })
    .from(rsvpResponses)
    .leftJoin(
      invitationRecipients,
      eq(rsvpResponses.recipientId, invitationRecipients.id),
    )
    .leftJoin(guests, eq(invitationRecipients.guestId, guests.id))
    .leftJoin(guestHouseholds, eq(rsvpResponses.householdId, guestHouseholds.id))
    .where(and(...conditions))
    .orderBy(
      ...(filters.redosled === 'ime'
        ? [asc(rsvpResponses.fullName)]
        : [desc(rsvpResponses.submittedAt)]),
    );

  const answers = await loadAnswersFor(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    adultsCount: row.adultsCount,
    childrenCount: row.childrenCount,
    companions: row.companions,
    message: row.message,
    submittedAt: row.submittedAt,
    lastEditedAt: row.lastEditedAt,
    guestName: row.guestFirstName
      ? [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ')
      : null,
    householdName: row.householdName,
    answers: answers.get(row.id) ?? {},
  }));
}

/** Jedan upit za sve odgovore na dodatna pitanja - bez N+1 (zahtev 32). */
async function loadAnswersFor(
  responseIds: readonly string[],
): Promise<Map<string, Record<string, RsvpAnswerValue>>> {
  const result = new Map<string, Record<string, RsvpAnswerValue>>();
  if (responseIds.length === 0) return result;

  const rows = await db
    .select({
      responseId: rsvpAnswers.responseId,
      questionId: rsvpAnswers.questionId,
      value: rsvpAnswers.value,
    })
    .from(rsvpAnswers)
    .where(inArray(rsvpAnswers.responseId, [...responseIds]));

  for (const row of rows) {
    const bucket = result.get(row.responseId) ?? {};
    bucket[row.questionId] = row.value;
    result.set(row.responseId, bucket);
  }

  return result;
}

export async function deleteRsvpResponse(
  eventId: string,
  responseId: string,
): Promise<void> {
  const { invitationId } = await requireInvitationId(eventId);

  const deleted = await db
    .delete(rsvpResponses)
    .where(
      and(
        eq(rsvpResponses.id, responseId),
        eq(rsvpResponses.invitationId, invitationId),
      ),
    )
    .returning({ id: rsvpResponses.id });

  if (deleted.length === 0) throw new NotFoundError('Odgovor ne postoji.');
}
