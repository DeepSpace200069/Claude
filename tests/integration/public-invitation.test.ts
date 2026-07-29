import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { addSection, type EditorDocument } from '@/features/editor/document';
import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { hashToken } from '@/lib/ids';
import { db } from '@/server/db';
import {
  featurePlans,
  guests,
  invitationRecipients,
  invitations,
  orders,
} from '@/server/db/schema';
import { ValidationError } from '@/server/authz/errors';
import { createEvent } from '@/server/services/events';
import { saveInvitationDraft } from '@/server/services/invitations';
import {
  getInvitationStats,
  recordInvitationShare,
  recordInvitationView,
  resolvePublicAccess,
} from '@/server/services/public-invitation';
import {
  getPublicationState,
  publishInvitation,
  unpublishInvitation,
  updateInvitationPrivacy,
} from '@/server/services/publishing';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Javna pozivnica: objavljivanje, privatnost, istek i statistika (zahtev 23 i 27).
 *
 * Ovo su pravila koja odlučuju da li gost uopšte vidi sadržaj, pa se proveravaju
 * nad pravom bazom - lažni podaci bi sakrili baš one greške zbog kojih test i
 * postoji.
 */
describe.skipIf(!hasTestDatabase)('javna pozivnica', () => {
  let userId: string;
  let eventId: string;
  let invitationId: string;
  let slug: string;

  /** Paket koji sme da objavljuje - podrazumevani besplatni ne sme. */
  async function allowPublishing(): Promise<void> {
    await db
      .update(featurePlans)
      .set({
        features: {
          ...DEFAULT_PLANS.free,
          flags: { ...DEFAULT_PLANS.free.flags, publish: true },
        },
      })
      .where(eq(featurePlans.code, 'free'));
  }

  beforeEach(async () => {
    await truncateAll();
    const { weddingTypeId } = await seedCatalog();
    await raiseEventLimit(null);

    const user = await createTestUser();
    userId = user.id;

    const created = await createEvent(userId, {
      eventTypeId: weddingTypeId,
      name: 'Ana i Marko',
      details: {},
      date: '2027-06-12',
      time: '15:00',
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Restoran Kej',
      primaryLocale: 'sr-Latn',
    });

    eventId = created.eventId;
    invitationId = created.invitationId;
    slug = created.slug;

    // Pozivnica sa sadržajem: prazna bi prošla proveru pristupa, ali ne bi
    // pokazala da se sekcije zaista čitaju na javnoj strani.
    const document = ['hero', 'message'].reduce<EditorDocument>(
      (accumulator, type) => {
        const result = addSection(accumulator, type);
        if (!result.ok) throw new Error(`Sekcija "${type}": ${result.reason}`);
        return result.document;
      },
      { theme: defaultThemeTokens, sections: [] },
    );

    await saveInvitationDraft({
      eventId,
      userId,
      baseRevision: 1,
      theme: document.theme,
      sections: document.sections,
    });
  });

  describe('objavljivanje', () => {
    it('nacrt se ne prikazuje gostu', async () => {
      const access = await resolvePublicAccess({ slug });
      expect(access.state).toBe('not_published');
    });

    it('besplatan paket ne može da objavi, i to kaže naglas', async () => {
      await expect(publishInvitation(eventId, userId)).rejects.toBeInstanceOf(
        ValidationError,
      );

      // Odbijanje ne sme da ostavi pozivnicu u polovičnom stanju.
      const state = await getPublicationState(eventId, userId);
      expect(state?.status).toBe('draft');
    });

    it('paket sa pravom objavljivanja objavljuje pozivnicu', async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);

      const access = await resolvePublicAccess({ slug });

      expect(access.state).toBe('ok');
      if (access.state !== 'ok') return;
      expect(access.invitation.document.sections.map((s) => s.type)).toEqual([
        'hero',
        'message',
      ]);
    });

    it('isključivanje gasi link, a sadržaj i slug ostaju', async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);
      await unpublishInvitation(eventId);

      expect((await resolvePublicAccess({ slug })).state).toBe('not_published');

      const state = await getPublicationState(eventId, userId);
      expect(state?.slug).toBe(slug);

      // Ponovno objavljivanje vraća **isti** link - već je podeljen gostima.
      await publishInvitation(eventId, userId);
      const again = await getPublicationState(eventId, userId);
      expect(again?.slug).toBe(slug);
      expect((await resolvePublicAccess({ slug })).state).toBe('ok');
    });

    it('nepostojeći slug se ne razlikuje od tuđeg', async () => {
      expect((await resolvePublicAccess({ slug: 'nema-me' })).state).toBe('not_found');
    });
  });

  describe('istek', () => {
    beforeEach(async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);
    });

    it('pozivnica važi do kraja izabranog dana', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '2027-06-20',
        shareTitle: '',
        shareDescription: '',
      });

      // Uveče na sam dan isteka gost mora da vidi pozivnicu.
      const evening = await resolvePublicAccess({
        slug,
        now: new Date('2027-06-20T20:00:00.000Z'),
      });
      expect(evening.state).toBe('ok');

      const nextDay = await resolvePublicAccess({
        slug,
        now: new Date('2027-06-21T10:00:00.000Z'),
      });
      expect(nextDay.state).toBe('expired');
    });

    it('uklanjanje datuma vraća pozivnicu u upotrebu', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '2020-01-01',
        shareTitle: '',
        shareDescription: '',
      });
      expect((await resolvePublicAccess({ slug })).state).toBe('expired');

      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });
      expect((await resolvePublicAccess({ slug })).state).toBe('ok');
    });
  });

  describe('PIN', () => {
    beforeEach(async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);
      await updateInvitationPrivacy({
        eventId,
        privacy: 'pin',
        pin: '4271',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });
    });

    it('bez PIN-a se sadržaj ne prikazuje', async () => {
      const access = await resolvePublicAccess({ slug });
      expect(access.state).toBe('pin_required');
    });

    it('tačan PIN otvara pozivnicu, pogrešan ne', async () => {
      expect((await resolvePublicAccess({ slug, pin: '4271' })).state).toBe('ok');

      const wrong = await resolvePublicAccess({ slug, pin: '0000' });
      expect(wrong.state).toBe('pin_required');
      if (wrong.state === 'pin_required') expect(wrong.wrongPin).toBe(true);
    });

    it('PIN se u bazi čuva samo kao heš', async () => {
      const [row] = await db
        .select({ pinHash: invitations.pinHash })
        .from(invitations)
        .where(eq(invitations.id, invitationId));

      expect(row?.pinHash).not.toBe('4271');
      expect(row?.pinHash).toBe(hashToken('4271'));
    });

    it('prazno polje zadržava postojeći PIN', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'pin',
        pin: '',
        expiresOn: '2027-06-20',
        shareTitle: '',
        shareDescription: '',
      });

      expect((await resolvePublicAccess({ slug, pin: '4271' })).state).toBe('ok');
    });

    it('prelazak na drugi režim briše PIN', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });

      const state = await getPublicationState(eventId, userId);
      expect(state?.hasPin).toBe(false);
      expect((await resolvePublicAccess({ slug })).state).toBe('ok');
    });

    it('režim sa PIN-om bez PIN-a se odbija', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });

      await expect(
        updateInvitationPrivacy({
          eventId,
          privacy: 'pin',
          pin: '',
          expiresOn: '',
          shareTitle: '',
          shareDescription: '',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('istek ima prednost nad PIN-om', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'pin',
        pin: '',
        expiresOn: '2020-01-01',
        shareTitle: '',
        shareDescription: '',
      });

      // Pozivnica koja je istekla ne traži PIN - ni sa tačnim PIN-om ne bi
      // imala šta da prikaže.
      expect((await resolvePublicAccess({ slug, pin: '4271' })).state).toBe('expired');
    });
  });

  describe('samo lični linkovi', () => {
    const token = 'TOKEN0123456789ABCDEFGHJKM';

    beforeEach(async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);
      await updateInvitationPrivacy({
        eventId,
        privacy: 'invite_only',
        pin: '',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });

      const [guest] = await db
        .insert(guests)
        .values({ eventId, firstName: 'Jelena', lastName: 'Petrović' })
        .returning({ id: guests.id });

      await db.insert(invitationRecipients).values({
        invitationId,
        guestId: guest!.id,
        tokenHash: hashToken(token),
        greetingName: 'Jelena',
      });
    });

    it('bez tokena se pozivnica ne otvara', async () => {
      expect((await resolvePublicAccess({ slug })).state).toBe('invite_only');
    });

    it('ispravan token otvara pozivnicu i nosi pozdrav po imenu', async () => {
      const access = await resolvePublicAccess({ slug, recipientToken: token });

      expect(access.state).toBe('ok');
      if (access.state === 'ok') expect(access.greetingName).toBe('Jelena');
    });

    it('izmišljen token ne prolazi', async () => {
      const access = await resolvePublicAccess({
        slug,
        recipientToken: 'NEPOSTOJECI0000000000000AB',
      });
      expect(access.state).toBe('invite_only');
    });

    it('povučen token prestaje da radi', async () => {
      await db
        .update(invitationRecipients)
        .set({ revokedAt: new Date() })
        .where(eq(invitationRecipients.invitationId, invitationId));

      expect(
        (await resolvePublicAccess({ slug, recipientToken: token })).state,
      ).toBe('invite_only');
    });

    it('token se u bazi čuva samo kao heš', async () => {
      const [row] = await db
        .select({ tokenHash: invitationRecipients.tokenHash })
        .from(invitationRecipients)
        .where(eq(invitationRecipients.invitationId, invitationId));

      expect(row?.tokenHash).not.toBe(token);
      expect(row?.tokenHash).toBe(hashToken(token));
    });

    it('token radi i kada pozivnica nije ograničena na lične linkove', async () => {
      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '',
        shareTitle: '',
        shareDescription: '',
      });

      const access = await resolvePublicAccess({ slug, recipientToken: token });
      expect(access.state).toBe('ok');
      if (access.state === 'ok') expect(access.greetingName).toBe('Jelena');
    });
  });

  describe('statistika', () => {
    it('sabira preglede po danu u zoni događaja', async () => {
      const timeZone = 'Europe/Belgrade';

      await recordInvitationView({
        invitationId,
        timeZone,
        isFirstVisit: true,
        now: new Date('2027-06-10T09:00:00.000Z'),
      });
      await recordInvitationView({
        invitationId,
        timeZone,
        isFirstVisit: false,
        now: new Date('2027-06-10T10:00:00.000Z'),
      });
      await recordInvitationView({
        invitationId,
        timeZone,
        isFirstVisit: true,
        now: new Date('2027-06-11T09:00:00.000Z'),
      });
      await recordInvitationShare({
        invitationId,
        timeZone,
        now: new Date('2027-06-11T09:30:00.000Z'),
      });

      const stats = await getInvitationStats(
        invitationId,
        timeZone,
        new Date('2027-06-10T12:00:00.000Z'),
      );

      expect(stats.total).toBe(3);
      expect(stats.unique).toBe(2);
      expect(stats.today).toBe(2);
      expect(stats.shares).toBe(1);
    });

    it('ne čuva ništa osim brojeva', async () => {
      await recordInvitationView({
        invitationId,
        timeZone: 'Europe/Belgrade',
        isFirstVisit: true,
      });

      const rows = await db.execute<{ column_name: string }>(
        // Sadržaj tabele je deo obećanja o privatnosti (zahtev 27): ako se
        // ikad doda kolona sa ličnim podatkom, ovaj test mora da padne.
        `select column_name from information_schema.columns
         where table_name = 'invitation_view_stats' order by column_name`,
      );

      expect(rows.map((row) => row.column_name)).toEqual([
        'created_at',
        'day',
        'id',
        'invitation_id',
        'shares',
        'unique_visitors',
        'updated_at',
        'views',
      ]);
    });
  });

  describe('kartica pri deljenju', () => {
    it('čuva naslov i opis koje organizator zada', async () => {
      await allowPublishing();
      await publishInvitation(eventId, userId);

      await updateInvitationPrivacy({
        eventId,
        privacy: 'unlisted',
        pin: '',
        expiresOn: '',
        shareTitle: 'Ana i Marko se venčavaju',
        shareDescription: '12. juna 2027, Beograd',
      });

      const access = await resolvePublicAccess({ slug });
      expect(access.state).toBe('ok');
      if (access.state !== 'ok') return;

      expect(access.invitation.share.title).toBe('Ana i Marko se venčavaju');
      expect(access.invitation.share.description).toBe('12. juna 2027, Beograd');
    });
  });

  describe('paket', () => {
    it('plaćen paket otključava objavljivanje bez izmene koda', async () => {
      const [plan] = await db
        .select({ id: featurePlans.id })
        .from(featurePlans)
        .where(eq(featurePlans.code, 'standard'));

      await db.insert(orders).values({
        userId,
        eventId,
        planId: plan!.id,
        status: 'paid',
        subtotalMinor: 200000,
        totalMinor: 200000,
        currency: 'RSD',
        idempotencyKey: 'test-narudzbina-1',
      });

      const state = await getPublicationState(eventId, userId);
      expect(state?.canPublish).toBe(true);
    });
  });
});
