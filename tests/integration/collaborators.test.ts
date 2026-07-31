import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { hashToken } from '@/lib/ids';
import { db } from '@/server/db';
import { eventCollaborators, featurePlans } from '@/server/db/schema';
import {
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '@/server/authz/errors';
import {
  acceptInvite,
  inviteCollaborator,
  listCollaborators,
  revokeCollaborator,
} from '@/server/services/collaborators';
import { createEvent } from '@/server/services/events';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Saradnici (zahtev 25 i 39.6).
 *
 * Ključne provere: token se čuva samo kao heš, poziv ne prihvata tuđi nalog, i
 * broj saradnika je limit paketa - a paket je vezan za pozivnicu.
 */
describe.skipIf(!hasTestDatabase)('saradnici', () => {
  let weddingTypeId: string;
  let owner: { id: string; email: string };
  let eventId: string;

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);

    // Besplatan paket namerno nema saradnike; testovi ih uključuju kao što bi
    // ih uključila kupovina paketa.
    await allowCollaborators(5);

    owner = await createTestUser({ email: 'vlasnik@primer.rs' });
    const event = await createEvent(owner.id, {
      eventTypeId: weddingTypeId,
      name: 'Milica i Stefan',
      details: {},
      date: '2026-09-12',
      time: '13:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Sala',
      primaryLocale: 'sr-Latn',
    });
    eventId = event.eventId;
  });

  /** Podiže besplatan paket na paket sa saradnicima. */
  async function allowCollaborators(limit: number | null): Promise<void> {
    const [row] = await db
      .select({ features: featurePlans.features })
      .from(featurePlans)
      .where(eq(featurePlans.code, 'free'))
      .limit(1);

    if (!row) throw new Error('Besplatan paket nije zasejan.');

    await db
      .update(featurePlans)
      .set({
        features: {
          ...row.features,
          flags: { ...row.features.flags, collaborators: limit !== 0 },
          limits: { ...row.features.limits, maxCollaborators: limit },
        },
      })
      .where(eq(featurePlans.code, 'free'));
  }

  /** Token iz poslatog mejla ne postoji u bazi, pa ga test uzima iz heša. */
  async function tokenFor(email: string): Promise<string> {
    // Test pravi svoj token i upisuje njegov heš - isti postupak kao servis,
    // samo obrnutim redom, jer pravi token živi jedino u mejlu.
    const token = 'TESTTOKEN1234567890ABCDEF';
    await db
      .update(eventCollaborators)
      .set({ inviteTokenHash: hashToken(token) })
      .where(eq(eventCollaborators.email, email));
    return token;
  }

  it('poziv upisuje saradnika u stanju čekanja i ne čuva sam token', async () => {
    await inviteCollaborator({
      eventId,
      email: 'Pomocnik@Primer.rs',
      role: 'editor',
      invitedBy: { id: owner.id, name: 'Vlasnik', email: owner.email },
      locale: 'sr-Latn',
    });

    const [row] = await db
      .select({
        email: eventCollaborators.email,
        status: eventCollaborators.status,
        tokenHash: eventCollaborators.inviteTokenHash,
        expiresAt: eventCollaborators.inviteExpiresAt,
      })
      .from(eventCollaborators);

    // Adresa se normalizuje: „Pomocnik@Primer.rs” i „pomocnik@primer.rs” su isti čovek.
    expect(row?.email).toBe('pomocnik@primer.rs');
    expect(row?.status).toBe('pending');
    expect(row?.tokenHash).toBeTruthy();
    // Heš je 64 heksadecimalna znaka; sam token nikad ne ulazi u bazu.
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.expiresAt).toBeInstanceOf(Date);
  });

  it('prihvatanje daje pristup događaju', async () => {
    const collaborator = await createTestUser({ email: 'pomocnik@primer.rs' });

    await inviteCollaborator({
      eventId,
      email: collaborator.email,
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const token = await tokenFor(collaborator.email);
    const result = await acceptInvite(token, collaborator);

    expect(result).toMatchObject({ state: 'ok', eventId });

    const [row] = await listCollaborators(eventId);
    expect(row?.status).toBe('accepted');
    expect(row?.acceptedAt).toBeInstanceOf(Date);
  });

  it('token se troši prihvatanjem', async () => {
    const collaborator = await createTestUser({ email: 'pomocnik@primer.rs' });
    await inviteCollaborator({
      eventId,
      email: collaborator.email,
      role: 'viewer',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const token = await tokenFor(collaborator.email);
    await acceptInvite(token, collaborator);

    // Isti link drugi put više ne važi - ni za istog korisnika.
    expect(await acceptInvite(token, collaborator)).toEqual({ state: 'invalid' });
  });

  it('tuđi nalog ne može da prihvati poziv', async () => {
    await inviteCollaborator({
      eventId,
      email: 'pozvani@primer.rs',
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const token = await tokenFor('pozvani@primer.rs');
    const drugi = await createTestUser({ email: 'neko.drugi@primer.rs' });

    const result = await acceptInvite(token, drugi);

    expect(result).toMatchObject({
      state: 'wrong_account',
      invitedEmail: 'pozvani@primer.rs',
    });

    const [row] = await listCollaborators(eventId);
    expect(row?.status).toBe('pending');
  });

  it('istekao poziv se odbija', async () => {
    const collaborator = await createTestUser({ email: 'kasni@primer.rs' });
    await inviteCollaborator({
      eventId,
      email: collaborator.email,
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const token = await tokenFor(collaborator.email);
    await db
      .update(eventCollaborators)
      .set({ inviteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(eventCollaborators.email, collaborator.email));

    expect(await acceptInvite(token, collaborator)).toEqual({ state: 'expired' });
  });

  it('ponovni poziv iste adrese osvežava postojeći red', async () => {
    const input = {
      eventId,
      email: 'pomocnik@primer.rs',
      role: 'editor' as const,
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn' as const,
    };

    const first = await inviteCollaborator(input);
    const second = await inviteCollaborator(input);

    expect(second.collaboratorId).toBe(first.collaboratorId);
    expect(await listCollaborators(eventId)).toHaveLength(1);
  });

  it('vlasnik ne može da pozove sam sebe', async () => {
    await expect(
      inviteCollaborator({
        eventId,
        email: owner.email,
        role: 'editor',
        invitedBy: { id: owner.id, name: null, email: owner.email },
        locale: 'sr-Latn',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('paket bez saradnika odbija poziv', async () => {
    await allowCollaborators(0);

    await expect(
      inviteCollaborator({
        eventId,
        email: 'pomocnik@primer.rs',
        role: 'editor',
        invitedBy: { id: owner.id, name: null, email: owner.email },
        locale: 'sr-Latn',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('limit paketa se poštuje', async () => {
    await allowCollaborators(1);

    await inviteCollaborator({
      eventId,
      email: 'prvi@primer.rs',
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    await expect(
      inviteCollaborator({
        eventId,
        email: 'drugi@primer.rs',
        role: 'editor',
        invitedBy: { id: owner.id, name: null, email: owner.email },
        locale: 'sr-Latn',
      }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });

  it('opozvan saradnik gubi pristup, ali ostaje u evidenciji', async () => {
    const collaborator = await createTestUser({ email: 'pomocnik@primer.rs' });
    await inviteCollaborator({
      eventId,
      email: collaborator.email,
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const token = await tokenFor(collaborator.email);
    await acceptInvite(token, collaborator);

    const [row] = await listCollaborators(eventId);
    if (!row) throw new Error('Nema saradnika.');

    await revokeCollaborator({ eventId, collaboratorId: row.id });

    const after = await listCollaborators(eventId);
    expect(after).toHaveLength(1);
    expect(after[0]?.status).toBe('revoked');
  });

  it('nepostojeći saradnik ne može da se opozove preko tuđeg događaja', async () => {
    const collaborator = await createTestUser({ email: 'pomocnik@primer.rs' });
    await inviteCollaborator({
      eventId,
      email: collaborator.email,
      role: 'editor',
      invitedBy: { id: owner.id, name: null, email: owner.email },
      locale: 'sr-Latn',
    });

    const [row] = await listCollaborators(eventId);
    if (!row) throw new Error('Nema saradnika.');

    // ID saradnika iz forme nije dokaz pristupa: upit je uvek ograničen i po
    // događaju, pa tuđi ID ne pogađa nijedan red.
    await expect(
      revokeCollaborator({
        eventId: '00000000-0000-0000-0000-000000000000',
        collaboratorId: row.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
