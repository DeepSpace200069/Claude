import 'dotenv/config';

import { eq, sql } from 'drizzle-orm';

import { DEFAULT_PLANS } from '@/features/billing/entitlements';
import { DEFAULT_DETAIL_FIELDS } from '@/features/events/details';
import { validateSectionData } from '@/features/sections/migrate';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { hashToken, randomToken } from '@/lib/ids';

import { db } from './index';
import {
  eventTypes,
  events,
  featurePlans,
  guestHouseholds,
  guestbookEntries,
  guests,
  invitationRecipients,
  invitationSections,
  invitations,
  rooms,
  rsvpAnswers,
  rsvpQuestions,
  rsvpResponses,
  seatAssignments,
  seatingPlanVersions,
  seatingPlans,
  tables,
  templateVersions,
  templates,
  themes,
  users,
} from './schema';
import { seedTemplates } from './seed-data/templates';
import { seedThemes } from './seed-data/themes';

/**
 * Seed podaci (zahtev 35).
 *
 * Skripta je idempotentna: svaki `insert` ima `onConflictDoUpdate` ili se
 * preskače, pa se `pnpm db:seed` može pokrenuti više puta bez dupliranja.
 * Sadržaj sekcija se **validira registrom sekcija** pre upisa - tako pokvaren
 * demo sadržaj pada odmah, a ne tek pri prikazu pozivnice.
 */

const EVENT_TYPES = [
  { key: 'wedding', slug: 'vencanje', labelKey: 'eventTypes.wedding', icon: 'rings', sortOrder: 10 },
  {
    key: 'wedding_christening',
    slug: 'vencanje-i-krstenje',
    labelKey: 'eventTypes.weddingChristening',
    icon: 'church',
    sortOrder: 20,
  },
  { key: 'christening', slug: 'krstenje', labelKey: 'eventTypes.christening', icon: 'church', sortOrder: 30 },
  {
    key: 'first_birthday',
    slug: 'prvi-rodjendan',
    labelKey: 'eventTypes.firstBirthday',
    icon: 'cake',
    sortOrder: 40,
  },
  { key: 'birthday', slug: 'rodjendan', labelKey: 'eventTypes.birthday', icon: 'cake', sortOrder: 50 },
  {
    key: 'coming_of_age',
    slug: 'punoletstvo',
    labelKey: 'eventTypes.comingOfAge',
    icon: 'sparkles',
    sortOrder: 60,
  },
  { key: 'other', slug: 'ostalo', labelKey: 'eventTypes.other', icon: 'star', sortOrder: 70 },
];

const PLANS = [
  {
    code: 'free',
    name: 'Besplatan nacrt',
    description: 'Napravite pozivnicu i pogledajte je pre nego što se odlučite.',
    priceMinor: 0,
    sortOrder: 10,
    isDefault: true,
    features: DEFAULT_PLANS.free,
  },
  {
    code: 'standard',
    name: 'Standard',
    description: 'Javni link, potvrde dolaska i izmene posle objavljivanja.',
    priceMinor: 290000,
    sortOrder: 20,
    isDefault: false,
    features: DEFAULT_PLANS.standard,
  },
  {
    code: 'premium',
    name: 'Premium',
    description: 'Svi šabloni, raspored sedenja, saradnici i izvoz podataka.',
    priceMinor: 490000,
    sortOrder: 30,
    isDefault: false,
    features: DEFAULT_PLANS.premium,
  },
];

const DEMO_EMAIL = 'demo@pozivnica.rs';
const ADMIN_EMAIL = 'admin@pozivnica.rs';

async function seedEventTypes() {
  for (const type of EVENT_TYPES) {
    await db
      .insert(eventTypes)
      .values({
        ...type,
        detailFields: DEFAULT_DETAIL_FIELDS[type.key] ?? [],
      })
      .onConflictDoUpdate({
        target: eventTypes.key,
        set: {
          slug: type.slug,
          labelKey: type.labelKey,
          icon: type.icon,
          sortOrder: type.sortOrder,
          detailFields: DEFAULT_DETAIL_FIELDS[type.key] ?? [],
        },
      });
  }
  console.log(`  · vrste događaja: ${EVENT_TYPES.length}`);
}

async function seedPlans() {
  for (const plan of PLANS) {
    await db
      .insert(featurePlans)
      .values({ ...plan, currency: 'RSD' })
      .onConflictDoUpdate({
        target: featurePlans.code,
        set: {
          name: plan.name,
          description: plan.description,
          priceMinor: plan.priceMinor,
          features: plan.features,
          sortOrder: plan.sortOrder,
          isDefault: plan.isDefault,
        },
      });
  }
  console.log(`  · paketi: ${PLANS.length}`);
}

async function seedThemesTable() {
  for (const theme of seedThemes) {
    await db
      .insert(themes)
      .values(theme)
      .onConflictDoUpdate({
        target: themes.key,
        set: { name: theme.name, tokens: theme.tokens },
      });
  }
  console.log(`  · teme: ${seedThemes.length}`);
}

async function seedTemplatesTable() {
  const typeRows = await db.select({ id: eventTypes.id, key: eventTypes.key }).from(eventTypes);
  const typeByKey = new Map(typeRows.map((row) => [row.key, row.id]));

  const themeRows = await db.select({ id: themes.id, key: themes.key, tokens: themes.tokens }).from(themes);
  const themeByKey = new Map(themeRows.map((row) => [row.key, row]));

  for (const template of seedTemplates) {
    const eventTypeId = typeByKey.get(template.eventTypeKey);
    const theme = themeByKey.get(template.themeKey);

    if (!eventTypeId || !theme) {
      throw new Error(`Šablon "${template.slug}" referiše nepostojeći tip ili temu.`);
    }

    // Validacija demo sadržaja kroz registar sekcija - ista provera kao za
    // korisnički unos, pa neispravan seed ne može da prođe.
    for (const sectionData of template.sections) {
      const result = validateSectionData(sectionData.type, sectionData.data);
      if (!result.ok) {
        throw new Error(
          `Šablon "${template.slug}", sekcija "${sectionData.type}": ${JSON.stringify(result.fieldErrors)}`,
        );
      }
    }

    const [templateRow] = await db
      .insert(templates)
      .values({
        slug: template.slug,
        name: template.name,
        description: template.description,
        eventTypeId,
        style: template.style,
        dominantColor: template.dominantColor,
        usesPhotos: template.usesPhotos,
        status: 'published',
        isFeatured: template.isFeatured,
        sortOrder: template.sortOrder,
        requiredPlanCode: template.requiredPlanCode,
      })
      .onConflictDoUpdate({
        target: templates.slug,
        set: {
          name: template.name,
          description: template.description,
          style: template.style,
          dominantColor: template.dominantColor,
          usesPhotos: template.usesPhotos,
          isFeatured: template.isFeatured,
          sortOrder: template.sortOrder,
          requiredPlanCode: template.requiredPlanCode,
          status: 'published',
        },
      })
      .returning({ id: templates.id });

    if (!templateRow) continue;

    const [versionRow] = await db
      .insert(templateVersions)
      .values({
        templateId: templateRow.id,
        version: 1,
        status: 'published',
        themeId: theme.id,
        themeTokens: theme.tokens,
        sections: template.sections,
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [templateVersions.templateId, templateVersions.version],
        set: {
          themeTokens: theme.tokens,
          sections: template.sections,
          status: 'published',
          publishedAt: new Date(),
        },
      })
      .returning({ id: templateVersions.id });

    if (versionRow) {
      await db
        .update(templates)
        .set({ publishedVersionId: versionRow.id })
        .where(eq(templates.id, templateRow.id));
    }
  }

  console.log(`  · šabloni: ${seedTemplates.length}`);
}

async function seedUsers() {
  const [demo] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: 'Milica Jovanović',
      emailVerified: new Date(),
      role: 'user',
      locale: 'sr-Latn',
      rsvpNotifications: 'daily',
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      name: 'Administrator',
      emailVerified: new Date(),
      role: 'admin',
      locale: 'sr-Latn',
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  const demoId =
    demo?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
        .limit(1)
    )[0]?.id;

  const adminId =
    admin?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${ADMIN_EMAIL}`)
        .limit(1)
    )[0]?.id;

  if (!demoId || !adminId) throw new Error('Demo korisnici nisu napravljeni.');

  console.log('  · korisnici: demo + administrator');
  return { demoId, adminId };
}

/** Demo domaćinstva i gosti sa realističnim srpskim imenima (zahtev 35). */
const DEMO_HOUSEHOLDS = [
  { name: 'Porodica Jovanović', members: [['Dragan', 'Jovanović', false], ['Vesna', 'Jovanović', false], ['Anđela', 'Jovanović', true]] },
  { name: 'Porodica Petrović', members: [['Miloš', 'Petrović', false], ['Jelena', 'Petrović', false]] },
  { name: 'Porodica Ilić', members: [['Nenad', 'Ilić', false], ['Sanja', 'Ilić', false], ['Luka', 'Ilić', true], ['Mia', 'Ilić', true]] },
  { name: 'Porodica Marković', members: [['Zoran', 'Marković', false], ['Gordana', 'Marković', false]] },
  { name: 'Porodica Nikolić', members: [['Aleksandar', 'Nikolić', false], ['Tijana', 'Nikolić', false]] },
  { name: 'Kolege iz kancelarije', members: [['Marko', 'Stanković', false], ['Ivana', 'Radovanović', false], ['Bojan', 'Đurić', false]] },
  { name: 'Porodica Simić', members: [['Dušan', 'Simić', false], ['Milena', 'Simić', false], ['Pavle', 'Simić', true]] },
  { name: 'Prijatelji sa fakulteta', members: [['Nevena', 'Todorović', false], ['Stefan', 'Lazić', false], ['Katarina', 'Mitrović', false]] },
] as const;

async function seedDemoEvent(ownerId: string) {
  const [weddingType] = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(eq(eventTypes.key, 'wedding'))
    .limit(1);

  const [template] = await db
    .select({
      id: templates.id,
      versionId: templates.publishedVersionId,
      tokens: templateVersions.themeTokens,
      sections: templateVersions.sections,
    })
    .from(templates)
    .innerJoin(templateVersions, eq(templates.publishedVersionId, templateVersions.id))
    .where(eq(templates.slug, 'vencanje-editorial-minimal'))
    .limit(1);

  if (!weddingType) throw new Error('Tip događaja "wedding" nije pronađen.');

  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.name, 'Milica i Stefan'))
    .limit(1);

  if (existing.length > 0) {
    console.log('  · demo događaj već postoji, preskačem');
    return;
  }

  const startsAt = new Date();
  startsAt.setMonth(startsAt.getMonth() + 4);
  startsAt.setHours(13, 0, 0, 0);

  const [event] = await db
    .insert(events)
    .values({
      ownerId,
      eventTypeId: weddingType.id,
      name: 'Milica i Stefan',
      details: { partner1Name: 'Milica', partner2Name: 'Stefan' },
      startsAt,
      timeZone: 'Europe/Belgrade',
      city: 'Beograd',
      venueName: 'Restoran Dunavski kej',
      primaryLocale: 'sr-Latn',
    })
    .returning({ id: events.id });

  if (!event) throw new Error('Demo događaj nije napravljen.');

  const [invitation] = await db
    .insert(invitations)
    .values({
      eventId: event.id,
      publicSlug: 'milica-i-stefan',
      title: 'Milica i Stefan',
      summary: 'Venčavamo se i radujemo se što ćete biti sa nama.',
      status: 'published',
      publishedAt: new Date(),
      templateId: template?.id ?? null,
      templateVersionId: template?.versionId ?? null,
      themeTokens: template?.tokens ?? defaultThemeTokens,
      privacy: 'unlisted',
    })
    .returning({ id: invitations.id });

  if (!invitation) throw new Error('Demo pozivnica nije napravljena.');

  if (template?.sections?.length) {
    await db.insert(invitationSections).values(
      template.sections.map((s, index) => ({
        invitationId: invitation.id,
        type: s.type,
        schemaVersion: s.schemaVersion,
        position: s.position ?? index,
        isVisible: s.isVisible,
        data: s.data,
      })),
    );
  }

  // Dodatna RSVP pitanja o hrani i prevozu (zahtev 35).
  const [menuQuestion] = await db
    .insert(rsvpQuestions)
    .values({
      invitationId: invitation.id,
      type: 'single_choice',
      label: 'Izbor menija',
      helpText: 'Molimo vas da izaberete jedno jelo.',
      isRequired: true,
      attendingOnly: true,
      position: 0,
      config: {
        options: [
          { value: 'meso', label: 'Meso' },
          { value: 'riba', label: 'Riba' },
          { value: 'vegetarijanski', label: 'Vegetarijanski' },
        ],
      },
    })
    .returning({ id: rsvpQuestions.id });

  const [transportQuestion, allergyQuestion] = await db.insert(rsvpQuestions).values([
    {
      invitationId: invitation.id,
      type: 'boolean',
      label: 'Da li vam je potreban prevoz do restorana?',
      isRequired: false,
      attendingOnly: true,
      position: 1,
      config: {},
    },
    {
      invitationId: invitation.id,
      type: 'text',
      label: 'Alergije ili posebni zahtevi',
      helpText: 'Ako nemate, ostavite prazno.',
      isRequired: false,
      attendingOnly: true,
      position: 2,
      config: { maxLength: 200 },
    },
  ])
    .returning({ id: rsvpQuestions.id });

  // Domaćinstva, gosti i personalizovani linkovi.
  let guestCount = 0;
  const guestIds: string[] = [];

  for (const household of DEMO_HOUSEHOLDS) {
    const [householdRow] = await db
      .insert(guestHouseholds)
      .values({
        eventId: event.id,
        name: household.name,
        maxGuests: household.members.length,
      })
      .returning({ id: guestHouseholds.id });

    if (!householdRow) continue;

    for (const [firstName, lastName, isChild] of household.members) {
      const [guestRow] = await db
        .insert(guests)
        .values({
          eventId: event.id,
          householdId: householdRow.id,
          firstName,
          lastName,
          isChild,
          tags: isChild ? ['deca'] : [],
        })
        .returning({ id: guests.id });

      if (guestRow) {
        guestIds.push(guestRow.id);
        guestCount += 1;
      }
    }

    // Token se čuva samo kao heš; u seed-u ga ispisujemo da bi demo link radio.
    const token = randomToken();
    await db.insert(invitationRecipients).values({
      invitationId: invitation.id,
      householdId: householdRow.id,
      tokenHash: hashToken(token),
      greetingName: household.name,
      maxGuests: household.members.length,
    });
  }

  /*
   * Različiti RSVP statusi da statistika na dashboardu ne bude prazna, i uz
   * njih odgovori na dodatna pitanja - inače bi demo prikazao pitanja koja
   * nikada nemaju odgovor, što je najgori mogući primer.
   */
  const responses = [
    { fullName: 'Dragan Jovanović', status: 'yes' as const, adults: 2, children: 1, message: 'Radujemo se!', menu: 'meso', transport: false, allergy: null },
    { fullName: 'Miloš Petrović', status: 'yes' as const, adults: 2, children: 0, message: null, menu: 'riba', transport: true, allergy: null },
    { fullName: 'Nenad Ilić', status: 'yes' as const, adults: 2, children: 2, message: 'Dolazimo svi četvoro.', menu: 'meso', transport: false, allergy: 'Jedno dete ne jede orašaste plodove.' },
    { fullName: 'Zoran Marković', status: 'no' as const, adults: 0, children: 0, message: 'Nažalost, putujemo tih dana.', menu: null, transport: null, allergy: null },
    { fullName: 'Aleksandar Nikolić', status: 'maybe' as const, adults: 2, children: 0, message: null, menu: null, transport: null, allergy: null },
    { fullName: 'Marko Stanković', status: 'yes' as const, adults: 1, children: 0, message: null, menu: 'vegetarijanski', transport: true, allergy: null },
  ];

  for (const response of responses) {
    const [row] = await db
      .insert(rsvpResponses)
      .values({
        invitationId: invitation.id,
        fullName: response.fullName,
        status: response.status,
        adultsCount: response.adults,
        childrenCount: response.children,
        message: response.message,
        editTokenHash: hashToken(randomToken()),
      })
      .returning({ id: rsvpResponses.id });

    if (!row) continue;

    const answers = [
      menuQuestion && response.menu
        ? { questionId: menuQuestion.id, value: response.menu }
        : null,
      transportQuestion && response.transport !== null
        ? { questionId: transportQuestion.id, value: response.transport }
        : null,
      allergyQuestion && response.allergy
        ? { questionId: allergyQuestion.id, value: response.allergy }
        : null,
    ].filter((answer) => answer !== null);

    if (answers.length > 0) {
      await db.insert(rsvpAnswers).values(
        answers.map((answer) => ({ responseId: row.id, ...answer })),
      );
    }
  }

  /*
   * Knjiga želja u sva tri stanja: odobrena poruka koju gosti vide, poruka
   * koja čeka domaćine i sakrivena. Demo u kome je sve odobreno ne bi pokazao
   * čemu moderacija služi (zahtev 9).
   */
  await db.insert(guestbookEntries).values([
    {
      invitationId: invitation.id,
      authorName: 'Vesna Jovanović',
      message: 'Neka vam zajednički put bude dug i pun smeha. Voli vas kuma Vesna.',
      reaction: '❤️',
      status: 'approved',
    },
    {
      invitationId: invitation.id,
      authorName: 'Bojan Đurić',
      message: 'Čestitke od celog tima! Jedva čekamo da zaigramo.',
      reaction: '🎉',
      status: 'approved',
    },
    {
      invitationId: invitation.id,
      authorName: 'Katarina Mitrović',
      message: 'Vidimo se u Kikindi! Nosim onu tortu koju svi traže.',
      reaction: null,
      status: 'pending',
    },
    {
      invitationId: invitation.id,
      authorName: 'Nepoznati posetilac',
      message: 'Poruka koju su domaćini sklonili sa javne stranice.',
      reaction: null,
      status: 'hidden',
    },
  ]);

  // Demo sala sa stolovima i nekoliko raspoređenih gostiju.
  const [plan] = await db
    .insert(seatingPlans)
    .values({ eventId: event.id, name: 'Glavna sala' })
    .returning({ id: seatingPlans.id });

  if (plan) {
    const [version] = await db
      .insert(seatingPlanVersions)
      .values({ planId: plan.id, version: 1, label: 'Prva verzija' })
      .returning({ id: seatingPlanVersions.id });

    if (version) {
      await db
        .update(seatingPlans)
        .set({ activeVersionId: version.id })
        .where(eq(seatingPlans.id, plan.id));

      const [room] = await db
        .insert(rooms)
        .values({ versionId: version.id, name: 'Velika sala', width: 1200, height: 800 })
        .returning({ id: rooms.id });

      if (room) {
        const tableRows = await db
          .insert(tables)
          .values([
            { roomId: room.id, name: 'Mladenački', shape: 'head', capacity: 6, x: 480, y: 80, width: 240, height: 90 },
            { roomId: room.id, name: 'Sto 1', shape: 'round', capacity: 8, x: 200, y: 300 },
            { roomId: room.id, name: 'Sto 2', shape: 'round', capacity: 8, x: 480, y: 300 },
            { roomId: room.id, name: 'Sto 3', shape: 'round', capacity: 8, x: 760, y: 300 },
            { roomId: room.id, name: 'Dečji sto', shape: 'square', capacity: 6, x: 480, y: 540 },
          ])
          .returning({ id: tables.id, name: tables.name });

        const firstTable = tableRows.find((t) => t.name === 'Sto 1');
        if (firstTable) {
          await db.insert(seatAssignments).values(
            guestIds.slice(0, 5).map((guestId, index) => ({
              tableId: firstTable.id,
              guestId,
              seatNumber: index + 1,
            })),
          );
        }
      }
    }
  }

  console.log(
    `  · demo venčanje: ${DEMO_HOUSEHOLDS.length} domaćinstava, ${guestCount} gostiju, ${responses.length} odgovora`,
  );
}

async function main() {
  console.log('Punim bazu demo podacima…');

  await seedEventTypes();
  await seedPlans();
  await seedThemesTable();
  await seedTemplatesTable();
  const { demoId } = await seedUsers();
  await seedDemoEvent(demoId);

  console.log('\nGotovo.');
  console.log(`Demo nalog: ${DEMO_EMAIL}`);
  console.log(`Administrator: ${ADMIN_EMAIL}`);
  console.log('Prijava ide magic linkom - link se ispisuje u terminalu servera.');

  process.exit(0);
}

main().catch((error) => {
  console.error('Seed nije uspeo:', error);
  process.exit(1);
});
