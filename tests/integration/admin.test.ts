import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { db } from '@/server/db';
import {
  auditLogs,
  eventTypes,
  featurePlans,
  orders,
  promoCodes,
  templateVersions,
  templates,
  themes,
  users,
} from '@/server/db/schema';
import { DevPaymentAdapter, setPaymentAdapter } from '@/server/adapters/payments';
import { NotFoundError, ValidationError } from '@/server/authz/errors';
import {
  activateOrder,
  createPromoCode,
  getAdminOverview,
  listEventTypes,
  listOrders,
  listTemplatesForAdmin,
  listUsers,
  publishTemplateVersion,
  setEventTypeActive,
  setTemplateStatus,
  setUserRole,
  updatePlan,
} from '@/server/services/admin';
import { startCheckout } from '@/server/services/billing';
import { getEventEntitlements } from '@/server/services/entitlements';
import { createEvent } from '@/server/services/events';

import {
  createTestUser,
  hasTestDatabase,
  raiseEventLimit,
  seedCatalog,
  truncateAll,
} from './helpers';

/**
 * Administracija (zahtev 19 i 24).
 *
 * Naglasak je na tragu: svaka radnja koja menja novac ili prava mora da ostavi
 * zapis u audit logu, jer se pola godine kasnije jedino po njemu zna ko je i
 * zašto nešto aktivirao.
 */
describe.skipIf(!hasTestDatabase)('administracija', () => {
  const adapter = new DevPaymentAdapter({ webhookSecret: 'admin-test-secret' });

  let weddingTypeId: string;
  let admin: { id: string; email: string };

  beforeAll(() => {
    setPaymentAdapter(adapter);
  });

  afterAll(() => {
    setPaymentAdapter(null);
  });

  beforeEach(async () => {
    await truncateAll();
    ({ weddingTypeId } = await seedCatalog());
    await raiseEventLimit(null);
    admin = await createTestUser({ role: 'admin', email: 'admin@primer.rs' });
  });

  async function auditActions(): Promise<string[]> {
    const rows = await db.select({ action: auditLogs.action }).from(auditLogs);
    return rows.map((row) => row.action);
  }

  describe('korisnici', () => {
    it('pretraga vraća korisnika sa brojem događaja', async () => {
      const user = await createTestUser({ email: 'mira@primer.rs' });
      await createEvent(user.id, {
        eventTypeId: weddingTypeId,
        name: 'Venčanje',
        details: {},
        date: '2026-09-12',
        time: '13:00',
        timeZone: 'Europe/Belgrade',
        city: 'Beograd',
        venueName: 'Sala',
        primaryLocale: 'sr-Latn',
      });

      const found = await listUsers({ query: 'mira' });

      expect(found).toHaveLength(1);
      expect(found[0]?.eventCount).toBe(1);
    });

    it('promena uloge se beleži u audit log', async () => {
      const user = await createTestUser();

      await setUserRole({ userId: user.id, role: 'admin', actor: admin });

      const [row] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id));
      expect(row?.role).toBe('admin');

      const [entry] = await db
        .select({
          action: auditLogs.action,
          actorEmail: auditLogs.actorEmail,
          changes: auditLogs.changes,
        })
        .from(auditLogs);

      expect(entry?.action).toBe('user.role_changed');
      expect(entry?.actorEmail).toBe(admin.email);
      expect(entry?.changes).toMatchObject({ from: 'user', to: 'admin' });
    });

    it('administrator ne može sam sebi da promeni ulogu', async () => {
      await expect(
        setUserRole({ userId: admin.id, role: 'user', actor: admin }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('narudžbine', () => {
    async function pendingOrder(): Promise<{ orderId: string; eventId: string }> {
      const user = await createTestUser();
      const event = await createEvent(user.id, {
        eventTypeId: weddingTypeId,
        name: 'Venčanje',
        details: {},
        date: '2026-09-12',
        time: '13:00',
        timeZone: 'Europe/Belgrade',
        city: 'Beograd',
        venueName: 'Sala',
        primaryLocale: 'sr-Latn',
      });

      const [premium] = await db
        .select({ id: featurePlans.id })
        .from(featurePlans)
        .where(eq(featurePlans.code, 'premium'))
        .limit(1);

      if (!premium) throw new Error('Premium paket nije zasejan.');

      const result = await startCheckout({
        userId: user.id,
        eventId: event.eventId,
        planId: premium.id,
        returnUrl: 'http://localhost:3000/povratak',
      });

      return { orderId: result.order.id, eventId: event.eventId };
    }

    it('ručna aktivacija plaća narudžbinu i ostavlja razlog u audit logu', async () => {
      const { orderId, eventId } = await pendingOrder();

      await activateOrder({
        orderId,
        reason: 'Uplata primljena na račun 265-000...',
        actor: admin,
      });

      const [order] = await db
        .select({ status: orders.status, paidAt: orders.paidAt })
        .from(orders)
        .where(eq(orders.id, orderId));

      expect(order?.status).toBe('paid');
      expect(order?.paidAt).toBeInstanceOf(Date);
      expect((await getEventEntitlements(eventId)).planCode).toBe('premium');

      const actions = await auditActions();
      expect(actions).toContain('order.paid.admin');
      expect(actions).toContain('order.activated_manually');
    });

    it('aktivacija bez razloga se odbija i ništa ne menja', async () => {
      const { orderId } = await pendingOrder();

      await expect(
        activateOrder({ orderId, reason: '  ', actor: admin }),
      ).rejects.toBeInstanceOf(ValidationError);

      const [order] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId));

      expect(order?.status).toBe('pending');
      expect(await auditActions()).toHaveLength(0);
    });

    it('filtriranje po statusu', async () => {
      await pendingOrder();

      expect(await listOrders({ status: 'pending' })).toHaveLength(1);
      expect(await listOrders({ status: 'paid' })).toHaveLength(0);
    });

    it('pregled broji plaćene narudžbine i prihod', async () => {
      const { orderId } = await pendingOrder();
      await activateOrder({ orderId, reason: 'Test aktivacija', actor: admin });

      const overview = await getAdminOverview();

      expect(overview.paidOrders).toBe(1);
      expect(overview.pendingOrders).toBe(0);
      expect(overview.revenueMinor).toBeGreaterThan(0);
    });
  });

  describe('paketi', () => {
    async function premiumPlanId(): Promise<string> {
      const [row] = await db
        .select({ id: featurePlans.id })
        .from(featurePlans)
        .where(eq(featurePlans.code, 'premium'))
        .limit(1);
      if (!row) throw new Error('Premium paket nije zasejan.');
      return row.id;
    }

    it('izmena limita odmah menja prava', async () => {
      const planId = await premiumPlanId();

      await updatePlan({
        planId,
        name: 'Premium',
        description: '',
        priceMinor: 300000,
        isActive: true,
        features: {
          ...DEFAULT_PLANS.premium,
          limits: { ...DEFAULT_PLANS.premium.limits, maxGuests: 42 },
        },
        actor: admin,
      });

      const [plan] = await db
        .select({ features: featurePlans.features, priceMinor: featurePlans.priceMinor })
        .from(featurePlans)
        .where(eq(featurePlans.id, planId));

      expect(plan?.features.limits.maxGuests).toBe(42);
      expect(plan?.priceMinor).toBe(300000);
      expect(await auditActions()).toContain('plan.updated');
    });

    it('neispravan oblik mogućnosti se odbija', async () => {
      await expect(
        updatePlan({
          planId: await premiumPlanId(),
          name: 'Premium',
          description: '',
          priceMinor: 1000,
          isActive: true,
          features: { flags: { nepostojeci: true }, limits: {} },
          actor: admin,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('podrazumevani paket ne može da se isključi', async () => {
      const [free] = await db
        .select({ id: featurePlans.id })
        .from(featurePlans)
        .where(eq(featurePlans.code, 'free'))
        .limit(1);

      await expect(
        updatePlan({
          planId: free?.id ?? '',
          name: 'Besplatan',
          description: '',
          priceMinor: 0,
          isActive: false,
          features: DEFAULT_PLANS.free,
          actor: admin,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('šabloni', () => {
    async function seedTemplate(): Promise<{ templateId: string; draftId: string }> {
      const [theme] = await db
        .insert(themes)
        .values({ key: 'admin-tema', name: 'Tema', tokens: defaultThemeTokens })
        .returning({ id: themes.id });

      const [template] = await db
        .insert(templates)
        .values({
          slug: 'admin-sablon',
          name: 'Admin šablon',
          eventTypeId: weddingTypeId,
          status: 'draft',
        })
        .returning({ id: templates.id });

      if (!template || !theme) throw new Error('Priprema šablona nije uspela.');

      const [draft] = await db
        .insert(templateVersions)
        .values({
          templateId: template.id,
          version: 1,
          status: 'draft',
          themeId: theme.id,
          themeTokens: defaultThemeTokens,
          sections: [],
        })
        .returning({ id: templateVersions.id });

      if (!draft) throw new Error('Verzija nije napravljena.');
      return { templateId: template.id, draftId: draft.id };
    }

    it('objavljivanje nacrta postavlja objavljenu verziju', async () => {
      const { templateId, draftId } = await seedTemplate();

      const [before] = await listTemplatesForAdmin();
      expect(before?.draftVersionId).toBe(draftId);
      expect(before?.publishedVersionId).toBeNull();

      await publishTemplateVersion({ templateId, versionId: draftId, actor: admin });

      const [after] = await listTemplatesForAdmin();
      expect(after?.publishedVersionId).toBe(draftId);
      expect(after?.status).toBe('published');
      expect(await auditActions()).toContain('template.version_published');
    });

    it('prethodna objavljena verzija se arhivira, a ne briše', async () => {
      const { templateId, draftId } = await seedTemplate();
      await publishTemplateVersion({ templateId, versionId: draftId, actor: admin });

      const [second] = await db
        .insert(templateVersions)
        .values({
          templateId,
          version: 2,
          status: 'draft',
          themeTokens: defaultThemeTokens,
          sections: [],
        })
        .returning({ id: templateVersions.id });

      if (!second) throw new Error('Druga verzija nije napravljena.');

      await publishTemplateVersion({ templateId, versionId: second.id, actor: admin });

      const versions = await db
        .select({ id: templateVersions.id, status: templateVersions.status })
        .from(templateVersions)
        .where(eq(templateVersions.templateId, templateId));

      expect(versions).toHaveLength(2);
      expect(versions.find((row) => row.id === draftId)?.status).toBe('archived');
      expect(versions.find((row) => row.id === second.id)?.status).toBe('published');
    });

    it('šablon bez objavljene verzije ne može da se objavi', async () => {
      const { templateId } = await seedTemplate();

      await expect(
        setTemplateStatus({ templateId, status: 'published', actor: admin }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('arhiviranje menja status i beleži se', async () => {
      const { templateId, draftId } = await seedTemplate();
      await publishTemplateVersion({ templateId, versionId: draftId, actor: admin });

      await setTemplateStatus({ templateId, status: 'archived', actor: admin });

      const [row] = await listTemplatesForAdmin();
      expect(row?.status).toBe('archived');
      expect(await auditActions()).toContain('template.status_changed');
    });
  });

  describe('vrste događaja i promo kodovi', () => {
    it('isključena vrsta ostaje u spisku, ali nije aktivna', async () => {
      const [type] = await listEventTypes();
      if (!type) throw new Error('Nema vrste događaja.');

      await setEventTypeActive({ eventTypeId: type.id, isActive: false, actor: admin });

      const [after] = await db
        .select({ isActive: eventTypes.isActive })
        .from(eventTypes)
        .where(eq(eventTypes.id, type.id));

      expect(after?.isActive).toBe(false);
      expect(await auditActions()).toContain('event_type.active_changed');
    });

    it('promo kod se pamti u kanonskom obliku', async () => {
      await createPromoCode({
        code: ' prolece25 ',
        kind: 'percent',
        value: 25,
        maxRedemptions: null,
        validUntil: null,
        actor: admin,
      });

      const [row] = await db.select({ code: promoCodes.code }).from(promoCodes);
      expect(row?.code).toBe('PROLECE25');
    });

    it('isti kod ne može da se napravi dvaput', async () => {
      const input = {
        code: 'LETO',
        kind: 'fixed' as const,
        value: 1000,
        maxRedemptions: null,
        validUntil: null,
        actor: admin,
      };

      await createPromoCode(input);
      await expect(createPromoCode(input)).rejects.toBeInstanceOf(ValidationError);
    });

    it('procenat van opsega se odbija', async () => {
      await expect(
        createPromoCode({
          code: 'PREVISE',
          kind: 'percent',
          value: 150,
          maxRedemptions: null,
          validUntil: null,
          actor: admin,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('nepostojeća vrsta događaja daje jasnu grešku', async () => {
      await expect(
        setEventTypeActive({
          eventTypeId: '00000000-0000-0000-0000-000000000000',
          isActive: false,
          actor: admin,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
