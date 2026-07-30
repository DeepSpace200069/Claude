import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { hashToken } from '@/lib/ids';
import { db } from '@/server/db';
import { rsvpAnswers, rsvpResponses } from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/authz/errors';
import { createEvent } from '@/server/services/events';
import {
  addGuestbookEntry,
  listApprovedEntries,
  listGuestbookEntries,
  moderateGuestbookEntry,
} from '@/server/services/guestbook';
import { createGuest, createHousehold, issueRecipientLink } from '@/server/services/guests';
import {
  createRsvpQuestion,
  findRecipientByToken,
  listRsvpQuestions,
  listRsvpResponses,
  loadResponseByEditToken,
  loadResponseForRecipient,
  requireInvitationId,
  submitRsvp,
  updateRsvpQuestion,
} from '@/server/services/rsvp';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  raiseGuestLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Potvrda dolaska od kraja do kraja.
 *
 * Ovde se proveravaju obećanja koja gost ne vidi, a na kojima sve stoji: da
 * jedan lični link daje najviše jedan odgovor, da se odgovor menja umesto da se
 * duplira i da tuđi token ne otvara tuđi odgovor (zahtev 39.6).
 */
const suite = hasTestDatabase ? describe : describe.skip;

const GUEST = {
  firstName: 'Marko',
  lastName: 'Ilić',
  email: '',
  phone: '',
  isChild: false,
  tags: [] as string[],
  privateNote: '',
  householdId: '',
};

suite('RSVP', () => {
  let userId: string;
  let eventId: string;
  let invitationId: string;

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);
    await raiseGuestLimit(null);

    const owner = await createTestUser();
    userId = owner.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Naše venčanje',
      details: {},
      date: '2026-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
    });

    eventId = created.eventId;
    invitationId = created.invitationId;
  });

  const baseSubmission = {
    recipient: null,
    responseId: null,
    fullName: 'Marko Ilić',
    email: '',
    phone: '',
    status: 'yes' as const,
    adultsCount: 2,
    childrenCount: 1,
    companions: [] as string[],
    message: '',
    answers: {} as Record<string, unknown>,
  };

  it('upisuje odgovor i vraća token za izmenu samo pri prvom slanju', async () => {
    const first = await submitRsvp({ ...baseSubmission, invitationId });

    expect(first.editToken).not.toBeNull();
    expect(first.isUpdate).toBe(false);

    const loaded = await loadResponseByEditToken(invitationId, first.editToken as string);
    expect(loaded?.fullName).toBe('Marko Ilić');
    expect(loaded?.adultsCount).toBe(2);

    // Izmena preko istog tokena menja postojeći odgovor, ne pravi novi.
    const second = await submitRsvp({
      ...baseSubmission,
      invitationId,
      responseId: loaded?.responseId ?? null,
      adultsCount: 3,
    });

    expect(second.isUpdate).toBe(true);
    expect(second.editToken).toBeNull();

    const all = await listRsvpResponses(eventId, { odgovor: 'svi', redosled: 'najnoviji' });
    expect(all).toHaveLength(1);
    expect(all[0]?.adultsCount).toBe(3);
  });

  it('token za izmenu se čuva samo kao heš', async () => {
    const result = await submitRsvp({ ...baseSubmission, invitationId });

    const [row] = await db
      .select({ hash: rsvpResponses.editTokenHash })
      .from(rsvpResponses)
      .where(eq(rsvpResponses.id, result.responseId));

    expect(row?.hash).toBe(hashToken(result.editToken as string));
  });

  it('tuđi token za izmenu ne otvara odgovor', async () => {
    await submitRsvp({ ...baseSubmission, invitationId });

    expect(await loadResponseByEditToken(invitationId, 'IZMISLJENTOKEN')).toBeNull();
  });

  it('isti lični link daje najviše jedan odgovor', async () => {
    const { guestId } = await createGuest(eventId, GUEST);
    const issued = await issueRecipientLink({ eventId, guestId });
    const recipient = await findRecipientByToken(invitationId, issued.token);

    expect(recipient).not.toBeNull();

    await submitRsvp({ ...baseSubmission, invitationId, recipient });
    // Dvostruki klik na "Pošalji" ne sme da napravi dva gosta.
    await submitRsvp({ ...baseSubmission, invitationId, recipient, adultsCount: 1 });

    const all = await listRsvpResponses(eventId, { odgovor: 'svi', redosled: 'najnoviji' });
    expect(all).toHaveLength(1);
    expect(all[0]?.adultsCount).toBe(1);

    const existing = await loadResponseForRecipient(recipient?.id ?? '');
    expect(existing?.adultsCount).toBe(1);
  });

  it('poštuje gornju granicu broja osoba sa linka domaćinstva', async () => {
    const { householdId } = await createHousehold(eventId, {
      name: 'Porodica Ilić',
      maxGuests: 2,
      notes: '',
    });
    const issued = await issueRecipientLink({ eventId, householdId });
    const recipient = await findRecipientByToken(invitationId, issued.token);

    await expect(
      submitRsvp({
        ...baseSubmission,
        invitationId,
        recipient,
        adultsCount: 3,
        childrenCount: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Isti gost u okviru granice prolazi.
    const ok = await submitRsvp({
      ...baseSubmission,
      invitationId,
      recipient,
      adultsCount: 2,
      childrenCount: 0,
    });
    expect(ok.status).toBe('yes');
  });

  it('„ne dolazim" nuluje broj osoba i pratnju', async () => {
    const result = await submitRsvp({
      ...baseSubmission,
      invitationId,
      status: 'no',
      adultsCount: 4,
      childrenCount: 2,
      companions: ['Ana', 'Petar'],
    });

    const [row] = await db
      .select({
        adults: rsvpResponses.adultsCount,
        children: rsvpResponses.childrenCount,
        companions: rsvpResponses.companions,
      })
      .from(rsvpResponses)
      .where(eq(rsvpResponses.id, result.responseId));

    expect(row?.adults).toBe(0);
    expect(row?.children).toBe(0);
    expect(row?.companions).toEqual([]);
  });

  it('odbija neispravan odgovor na dodatno pitanje', async () => {
    await createRsvpQuestion(eventId, {
      type: 'single_choice',
      label: 'Izbor menija',
      helpText: '',
      isRequired: true,
      attendingOnly: true,
      options: [{ value: '', label: 'Meso' }, { value: '', label: 'Riba' }],
      min: '',
      max: '',
      maxLength: '',
    });

    const [question] = await listRsvpQuestions(invitationId);
    expect(question?.config.options).toHaveLength(2);

    await expect(
      submitRsvp({
        ...baseSubmission,
        invitationId,
        answers: { [question?.id ?? '']: 'ne-postoji' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Obavezno pitanje bez odgovora takođe pada.
    await expect(
      submitRsvp({ ...baseSubmission, invitationId, answers: {} }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('promena odgovora sa „dolazim" na „ne dolazim" briše odgovore na pitanja o dolasku', async () => {
    await createRsvpQuestion(eventId, {
      type: 'text',
      label: 'Alergije',
      helpText: '',
      isRequired: false,
      attendingOnly: true,
      options: [],
      min: '',
      max: '',
      maxLength: '',
    });

    const [question] = await listRsvpQuestions(invitationId);
    const questionId = question?.id ?? '';

    const first = await submitRsvp({
      ...baseSubmission,
      invitationId,
      answers: { [questionId]: 'Bez orašastih plodova' },
    });

    expect(
      await db.select().from(rsvpAnswers).where(eq(rsvpAnswers.responseId, first.responseId)),
    ).toHaveLength(1);

    await submitRsvp({
      ...baseSubmission,
      invitationId,
      responseId: first.responseId,
      status: 'no',
      answers: {},
    });

    // Pitanje koje gost više ne vidi ne sme da ostane kao njegov odgovor.
    expect(
      await db.select().from(rsvpAnswers).where(eq(rsvpAnswers.responseId, first.responseId)),
    ).toHaveLength(0);
  });

  it('preformulisana opcija zadržava ključ, pa raniji odgovori i dalje važe', async () => {
    await createRsvpQuestion(eventId, {
      type: 'single_choice',
      label: 'Izbor menija',
      helpText: '',
      isRequired: false,
      attendingOnly: false,
      options: [{ value: '', label: 'Pileće' }, { value: '', label: 'Riba' }],
      min: '',
      max: '',
      maxLength: '',
    });

    const [question] = await listRsvpQuestions(invitationId);
    const questionId = question?.id ?? '';
    const firstOption = question?.config.options?.[0]?.value ?? '';

    await submitRsvp({
      ...baseSubmission,
      invitationId,
      answers: { [questionId]: firstOption },
    });

    await updateRsvpQuestion(eventId, questionId, {
      type: 'single_choice',
      label: 'Izbor menija',
      helpText: '',
      isRequired: false,
      attendingOnly: false,
      // Ista opcija, drugačija formulacija - ključ se prosleđuje nazad.
      options: [
        { value: firstOption, label: 'Piletina' },
        { value: question?.config.options?.[1]?.value ?? '', label: 'Riba' },
      ],
      min: '',
      max: '',
      maxLength: '',
    });

    const [updated] = await listRsvpQuestions(invitationId);
    expect(updated?.config.options?.[0]).toEqual({ value: firstOption, label: 'Piletina' });

    const responses = await listRsvpResponses(eventId, {
      odgovor: 'svi',
      redosled: 'najnoviji',
    });
    expect(responses[0]?.answers[questionId]).toBe(firstOption);
  });

  it('pretraga i filtriranje odgovora rade zajedno', async () => {
    await submitRsvp({ ...baseSubmission, invitationId, fullName: 'Marko Ilić' });
    await submitRsvp({
      ...baseSubmission,
      invitationId,
      fullName: 'Ana Popović',
      status: 'no',
    });

    const dolaze = await listRsvpResponses(eventId, {
      odgovor: 'yes',
      redosled: 'ime',
    });
    expect(dolaze.map((r) => r.fullName)).toEqual(['Marko Ilić']);

    const pretraga = await listRsvpResponses(eventId, {
      odgovor: 'svi',
      pretraga: 'popov',
      redosled: 'ime',
    });
    expect(pretraga.map((r) => r.fullName)).toEqual(['Ana Popović']);
  });

  it('pozivnica se traži uz događaj, pa tuđi identifikator ne prolazi', async () => {
    await expect(
      requireInvitationId('11111111-2222-4333-8444-555555555555'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

suite('knjiga želja', () => {
  let userId: string;
  let eventId: string;
  let invitationId: string;

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);

    const owner = await createTestUser();
    userId = owner.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Naše venčanje',
      details: {},
      date: '2026-09-12',
      time: '17:00',
      timeZone: 'Europe/Belgrade',
      city: 'Novi Sad',
      venueName: 'Salaš 137',
      primaryLocale: 'sr-Latn',
    });

    eventId = created.eventId;
    invitationId = created.invitationId;
  });

  it('poruka sa moderacijom ne izlazi na javnu stranicu dok se ne odobri', async () => {
    const created = await addGuestbookEntry({
      invitationId,
      authorName: 'Vesna Jovanović',
      message: 'Srećno vam bilo!',
      reaction: '❤️',
      ipHash: 'otisak',
      requireApproval: true,
    });

    expect(created.status).toBe('pending');
    expect(await listApprovedEntries(invitationId)).toHaveLength(0);

    await moderateGuestbookEntry(eventId, created.entryId, 'approved');

    const approved = await listApprovedEntries(invitationId);
    expect(approved).toHaveLength(1);
    expect(approved[0]?.authorName).toBe('Vesna Jovanović');
  });

  it('bez moderacije poruka odmah izlazi', async () => {
    const created = await addGuestbookEntry({
      invitationId,
      authorName: 'Bojan Đurić',
      message: 'Čestitke!',
      reaction: null,
      ipHash: null,
      requireApproval: false,
    });

    expect(created.status).toBe('approved');
    expect(await listApprovedEntries(invitationId)).toHaveLength(1);
  });

  it('sakrivena poruka nestaje sa javne stranice', async () => {
    const created = await addGuestbookEntry({
      invitationId,
      authorName: 'Neko',
      message: 'Poruka koja ne treba da stoji.',
      reaction: null,
      ipHash: null,
      requireApproval: false,
    });

    await moderateGuestbookEntry(eventId, created.entryId, 'hidden');

    expect(await listApprovedEntries(invitationId)).toHaveLength(0);
    expect(await listGuestbookEntries(eventId, 'hidden')).toHaveLength(1);
  });

  it('tuđi događaj ne može da moderira poruku', async () => {
    const created = await addGuestbookEntry({
      invitationId,
      authorName: 'Neko',
      message: 'Poruka.',
      reaction: null,
      ipHash: null,
      requireApproval: true,
    });

    await expect(
      moderateGuestbookEntry(
        '11111111-2222-4333-8444-555555555555',
        created.entryId,
        'approved',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
