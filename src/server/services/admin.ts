import 'server-only';

import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import { planFeaturesSchema, type PlanFeatures } from '@/features/billing/entitlements';
import { db } from '@/server/db';
import {
  eventTypes,
  events,
  featurePlans,
  guestbookEntries,
  invitations,
  orders,
  promoCodes,
  templateVersions,
  templates,
  users,
} from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/authz/errors';

import { writeAuditLog } from './audit';
import { normalizePromoCode, settleOrder } from './billing';

/**
 * Administracija platforme (zahtev 19).
 *
 * Sve funkcije ovde pretpostavljaju da je pozivalac već prošao `requireAdmin()`;
 * provera prava je u akcijama i stranicama, a ne ovde, da se ne bi dva puta
 * čitala sesija.
 *
 * Svaka radnja koja menja tuđ sadržaj, novac ili prava upisuje se u audit log
 * (zahtev 24). Zapis nosi i ko je akter - „sistem je promenio” nije trag.
 */

export type AdminOverview = {
  users: number;
  events: number;
  publishedInvitations: number;
  paidOrders: number;
  pendingOrders: number;
  revenueMinor: number;
  pendingGuestbookEntries: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    [userCount],
    [eventCount],
    [publishedCount],
    orderTotals,
    [pendingEntries],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db
      .select({ value: count() })
      .from(events)
      .where(isNull(events.deletedAt)),
    db
      .select({ value: count() })
      .from(invitations)
      .where(eq(invitations.status, 'published')),
    db
      .select({
        status: orders.status,
        value: count(),
        // Prihod se sabira samo nad plaćenim narudžbinama; `filter` bi ovde
        // bio suvišan jer se grupiše po statusu.
        total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
      })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({ value: count() })
      .from(guestbookEntries)
      .where(eq(guestbookEntries.status, 'pending')),
  ]);

  const paid = orderTotals.find((row) => row.status === 'paid');
  const pending = orderTotals.find((row) => row.status === 'pending');

  return {
    users: userCount?.value ?? 0,
    events: eventCount?.value ?? 0,
    publishedInvitations: publishedCount?.value ?? 0,
    paidOrders: paid?.value ?? 0,
    pendingOrders: pending?.value ?? 0,
    revenueMinor: paid?.total ?? 0,
    pendingGuestbookEntries: pendingEntries?.value ?? 0,
  };
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  createdAt: Date;
  eventCount: number;
};

/** Spisak korisnika sa brojem događaja; pretraga po imenu ili email adresi. */
export async function listUsers(options: {
  query?: string;
  limit?: number;
}): Promise<AdminUserRow[]> {
  const term = options.query?.trim();

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      /*
       * Podupit, a ne `left join` + `group by`: korisnik bez događaja mora da
       * ostane u rezultatu, a spajanje sa tabelom `events` bi zahtevalo i
       * filtriranje obrisanih događaja u `on` uslovu.
       */
      eventCount: sql<number>`(
        select count(*)::int from events e
        where e.owner_id = users.id and e.deleted_at is null
      )`,
    })
    .from(users)
    .where(
      term
        ? or(ilike(users.email, `%${term}%`), ilike(users.name, `%${term}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(options.limit ?? 50);
}

/**
 * Promena uloge korisnika.
 *
 * Administrator ne sme sam sebi da oduzme ulogu - inače bi jedan pogrešan klik
 * mogao da ostavi sistem bez ijednog administratora.
 */
export async function setUserRole(input: {
  userId: string;
  role: 'user' | 'admin';
  actor: { id: string; email: string };
}): Promise<void> {
  if (input.userId === input.actor.id) {
    throw new ValidationError('Ne možete sami sebi promeniti ulogu.');
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!target) throw new NotFoundError('Korisnik ne postoji.');
  if (target.role === input.role) return;

  await db.update(users).set({ role: input.role }).where(eq(users.id, target.id));

  await writeAuditLog({
    action: 'user.role_changed',
    entityType: 'user',
    entityId: target.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { from: target.role, to: input.role, email: target.email },
  });
}

export type AdminOrderRow = {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  totalMinor: number;
  currency: string;
  planName: string;
  userEmail: string;
  eventName: string | null;
  eventId: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

export async function listOrders(options: {
  status?: AdminOrderRow['status'];
  limit?: number;
}): Promise<AdminOrderRow[]> {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      planName: featurePlans.name,
      userEmail: users.email,
      eventName: events.name,
      eventId: orders.eventId,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .innerJoin(featurePlans, eq(orders.planId, featurePlans.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(options.status ? eq(orders.status, options.status) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(options.limit ?? 50);
}

/**
 * Ručna potvrda uplate i besplatna aktivacija (zahtev 7.3).
 *
 * Ovo je jedini put kojim narudžbina postaje plaćena bez provajdera i zato
 * uvek traži razlog: „zašto je ovo aktivirano besplatno” mora da se vidi u
 * audit logu i godinu dana kasnije.
 */
export async function activateOrder(input: {
  orderId: string;
  reason: string;
  actor: { id: string; email: string };
}): Promise<void> {
  const note = input.reason.trim();
  if (note.length < 3) {
    throw new ValidationError('Unesite razlog aktivacije.', {
      reason: ['Razlog je obavezan i beleži se u audit log.'],
    });
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!order) throw new NotFoundError('Narudžbina ne postoji.');

  await settleOrder({
    orderId: order.id,
    reason: 'admin',
    actor: input.actor,
  });

  await writeAuditLog({
    action: 'order.activated_manually',
    entityType: 'order',
    entityId: order.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { reason: note },
  });
}

export type AdminPlanRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  features: PlanFeatures;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
};

export async function listPlans(): Promise<AdminPlanRow[]> {
  return db
    .select({
      id: featurePlans.id,
      code: featurePlans.code,
      name: featurePlans.name,
      description: featurePlans.description,
      priceMinor: featurePlans.priceMinor,
      currency: featurePlans.currency,
      features: featurePlans.features,
      sortOrder: featurePlans.sortOrder,
      isActive: featurePlans.isActive,
      isDefault: featurePlans.isDefault,
    })
    .from(featurePlans)
    .orderBy(featurePlans.sortOrder);
}

/**
 * Izmena paketa i njegovih limita.
 *
 * Oblik `features` se validira šemom pre upisa: pogrešan ključ u JSONB-u ne bi
 * srušio upis, ali bi tiho isključio mogućnost svim korisnicima tog paketa.
 */
export async function updatePlan(input: {
  planId: string;
  name: string;
  description: string;
  priceMinor: number;
  isActive: boolean;
  features: unknown;
  actor: { id: string; email: string };
}): Promise<void> {
  const [plan] = await db
    .select({
      id: featurePlans.id,
      code: featurePlans.code,
      priceMinor: featurePlans.priceMinor,
      features: featurePlans.features,
      isDefault: featurePlans.isDefault,
    })
    .from(featurePlans)
    .where(eq(featurePlans.id, input.planId))
    .limit(1);

  if (!plan) throw new NotFoundError('Paket ne postoji.');

  const parsed = planFeaturesSchema.safeParse(input.features);
  if (!parsed.success) {
    throw new ValidationError('Mogućnosti paketa nisu ispravnog oblika.');
  }

  if (plan.isDefault && !input.isActive) {
    throw new ValidationError(
      'Podrazumevani paket ne može da se isključi - novi korisnici bi ostali bez ijednog paketa.',
    );
  }

  await db
    .update(featurePlans)
    .set({
      name: input.name,
      description: input.description,
      priceMinor: input.priceMinor,
      isActive: input.isActive,
      features: parsed.data,
    })
    .where(eq(featurePlans.id, plan.id));

  await writeAuditLog({
    action: 'plan.updated',
    entityType: 'plan',
    entityId: plan.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: {
      code: plan.code,
      priceFrom: plan.priceMinor,
      priceTo: input.priceMinor,
      features: parsed.data,
    },
  });
}

export type AdminTemplateRow = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  eventTypeKey: string;
  requiredPlanCode: string;
  isFeatured: boolean;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  versionCount: number;
};

export async function listTemplatesForAdmin(): Promise<AdminTemplateRow[]> {
  return db
    .select({
      id: templates.id,
      slug: templates.slug,
      name: templates.name,
      status: templates.status,
      eventTypeKey: eventTypes.key,
      requiredPlanCode: templates.requiredPlanCode,
      isFeatured: templates.isFeatured,
      publishedVersionId: templates.publishedVersionId,
      draftVersionId: sql<string | null>`(
        select v.id from template_versions v
        where v.template_id = templates.id and v.status = 'draft'
        order by v.version desc limit 1
      )`,
      versionCount: sql<number>`(
        select count(*)::int from template_versions v
        where v.template_id = templates.id
      )`,
    })
    .from(templates)
    .innerJoin(eventTypes, eq(templates.eventTypeId, eventTypes.id))
    .orderBy(templates.sortOrder, templates.name);
}

/**
 * Objavljivanje nacrta verzije šablona (zahtev 7.6).
 *
 * Objavljivanje **ne menja** postojeće pozivnice: one nose svoj snimak sekcija
 * od trenutka kreiranja. Menja se samo ono od čega kreću nove pozivnice.
 */
export async function publishTemplateVersion(input: {
  templateId: string;
  versionId: string;
  actor: { id: string; email: string };
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [version] = await tx
      .select({ id: templateVersions.id, status: templateVersions.status })
      .from(templateVersions)
      .where(
        and(
          eq(templateVersions.id, input.versionId),
          eq(templateVersions.templateId, input.templateId),
        ),
      )
      .limit(1);

    if (!version) throw new NotFoundError('Verzija šablona ne postoji.');

    // Prethodna objavljena verzija se arhivira, a ne briše: pozivnice koje su
    // od nje nastale i dalje se pozivaju na nju u istoriji.
    await tx
      .update(templateVersions)
      .set({ status: 'archived' })
      .where(
        and(
          eq(templateVersions.templateId, input.templateId),
          eq(templateVersions.status, 'published'),
        ),
      );

    await tx
      .update(templateVersions)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(templateVersions.id, version.id));

    await tx
      .update(templates)
      .set({ publishedVersionId: version.id, status: 'published' })
      .where(eq(templates.id, input.templateId));

    await writeAuditLog(
      {
        action: 'template.version_published',
        entityType: 'template',
        entityId: input.templateId,
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        changes: { versionId: version.id },
      },
      tx,
    );
  });
}

/**
 * Arhiviranje šablona.
 *
 * Šablon nestaje iz galerije, ali pozivnice napravljene od njega nastavljaju da
 * rade - one ionako nose svoj snimak sekcija.
 */
export async function setTemplateStatus(input: {
  templateId: string;
  status: 'draft' | 'published' | 'archived';
  actor: { id: string; email: string };
}): Promise<void> {
  const [template] = await db
    .select({
      id: templates.id,
      status: templates.status,
      publishedVersionId: templates.publishedVersionId,
    })
    .from(templates)
    .where(eq(templates.id, input.templateId))
    .limit(1);

  if (!template) throw new NotFoundError('Šablon ne postoji.');

  if (input.status === 'published' && !template.publishedVersionId) {
    throw new ValidationError(
      'Šablon nema objavljenu verziju - prvo objavite verziju, pa onda šablon.',
    );
  }

  await db
    .update(templates)
    .set({ status: input.status })
    .where(eq(templates.id, template.id));

  await writeAuditLog({
    action: 'template.status_changed',
    entityType: 'template',
    entityId: template.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { from: template.status, to: input.status },
  });
}

export type AdminEventTypeRow = {
  id: string;
  key: string;
  slug: string;
  labelKey: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  templateCount: number;
};

export async function listEventTypes(): Promise<AdminEventTypeRow[]> {
  return db
    .select({
      id: eventTypes.id,
      key: eventTypes.key,
      slug: eventTypes.slug,
      labelKey: eventTypes.labelKey,
      icon: eventTypes.icon,
      sortOrder: eventTypes.sortOrder,
      isActive: eventTypes.isActive,
      templateCount: sql<number>`(
        select count(*)::int from templates t
        where t.event_type_id = event_types.id
      )`,
    })
    .from(eventTypes)
    .orderBy(eventTypes.sortOrder);
}

/**
 * Uključivanje i isključivanje vrste događaja.
 *
 * Brisanje se ne nudi: šema ga ograničava (`restrict`) dok postoje šabloni, a i
 * kada bi bilo moguće, postojeći događaji te vrste ostali bi bez naziva.
 * Isključena vrsta samo prestaje da se nudi za nove događaje.
 */
export async function setEventTypeActive(input: {
  eventTypeId: string;
  isActive: boolean;
  actor: { id: string; email: string };
}): Promise<void> {
  const [row] = await db
    .select({ id: eventTypes.id, key: eventTypes.key, isActive: eventTypes.isActive })
    .from(eventTypes)
    .where(eq(eventTypes.id, input.eventTypeId))
    .limit(1);

  if (!row) throw new NotFoundError('Vrsta događaja ne postoji.');

  await db
    .update(eventTypes)
    .set({ isActive: input.isActive })
    .where(eq(eventTypes.id, row.id));

  await writeAuditLog({
    action: 'event_type.active_changed',
    entityType: 'event_type',
    entityId: row.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { key: row.key, from: row.isActive, to: input.isActive },
  });
}

export type AdminPromoRow = {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free';
  value: number;
  maxRedemptions: number | null;
  redemptions: number;
  validUntil: Date | null;
  isActive: boolean;
};

export async function listPromoCodes(): Promise<AdminPromoRow[]> {
  return db
    .select({
      id: promoCodes.id,
      code: promoCodes.code,
      kind: promoCodes.kind,
      value: promoCodes.value,
      maxRedemptions: promoCodes.maxRedemptions,
      redemptions: promoCodes.redemptions,
      validUntil: promoCodes.validUntil,
      isActive: promoCodes.isActive,
    })
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt));
}

export async function createPromoCode(input: {
  code: string;
  kind: 'percent' | 'fixed' | 'free';
  value: number;
  maxRedemptions: number | null;
  validUntil: Date | null;
  actor: { id: string; email: string };
}): Promise<void> {
  // Isti kanonski oblik kao pri naplati - inače kod upisan malim slovima nikad
  // ne bi bio pronađen.
  const code = normalizePromoCode(input.code);

  if (code.length < 3) {
    throw new ValidationError('Kod mora imati bar tri znaka.', {
      code: ['Prekratak kod.'],
    });
  }

  if (input.kind === 'percent' && (input.value < 1 || input.value > 100)) {
    throw new ValidationError('Procenat mora biti između 1 i 100.', {
      value: ['Unesite vrednost od 1 do 100.'],
    });
  }

  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  if (existing) {
    throw new ValidationError('Taj kod već postoji.', { code: ['Kod je zauzet.'] });
  }

  await db.insert(promoCodes).values({
    code,
    kind: input.kind,
    value: input.kind === 'free' ? 0 : input.value,
    maxRedemptions: input.maxRedemptions,
    validUntil: input.validUntil,
  });

  await writeAuditLog({
    action: 'promo_code.created',
    entityType: 'promo_code',
    entityId: code,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { kind: input.kind, value: input.value },
  });
}

export async function setPromoCodeActive(input: {
  promoCodeId: string;
  isActive: boolean;
  actor: { id: string; email: string };
}): Promise<void> {
  const [row] = await db
    .select({ id: promoCodes.id, code: promoCodes.code })
    .from(promoCodes)
    .where(eq(promoCodes.id, input.promoCodeId))
    .limit(1);

  if (!row) throw new NotFoundError('Promo kod ne postoji.');

  await db
    .update(promoCodes)
    .set({ isActive: input.isActive })
    .where(eq(promoCodes.id, row.id));

  await writeAuditLog({
    action: 'promo_code.active_changed',
    entityType: 'promo_code',
    entityId: row.id,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    changes: { code: row.code, isActive: input.isActive },
  });
}
