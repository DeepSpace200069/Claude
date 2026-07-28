/**
 * Demo šabloni (zahtev 11 i 35).
 *
 * Najmanje po dva šablona za svaku glavnu kategoriju. Sadržaj je originalan i
 * napisan realističnim, izmišljenim srpskim podacima - bez lorem ipsuma.
 */
export type SeedSection = {
  type: string;
  schemaVersion: number;
  position: number;
  isVisible: boolean;
  data: Record<string, unknown>;
};

export type SeedTemplate = {
  slug: string;
  name: string;
  description: string;
  eventTypeKey: string;
  themeKey: string;
  style: string;
  dominantColor: string;
  usesPhotos: boolean;
  isFeatured: boolean;
  requiredPlanCode: 'free' | 'standard' | 'premium';
  sortOrder: number;
  sections: SeedSection[];
};

const section = (
  type: string,
  position: number,
  data: Record<string, unknown>,
): SeedSection => ({ type, schemaVersion: 1, position, isVisible: true, data });

export const seedTemplates: SeedTemplate[] = [
  // --- Venčanje ------------------------------------------------------------
  {
    slug: 'vencanje-editorial-minimal',
    name: 'Editorial minimal',
    description:
      'Mirna tipografska pozivnica sa dosta belog prostora. Za parove koji žele da tekst i datum budu u prvom planu.',
    eventTypeKey: 'wedding',
    themeKey: 'editorial-ivory',
    style: 'minimal',
    dominantColor: '#f7f4ef',
    usesPhotos: false,
    isFeatured: true,
    requiredPlanCode: 'free',
    sortOrder: 10,
    sections: [
      section('hero', 0, {
        eyebrow: 'Pozivamo vas',
        title: 'Milica i Stefan',
        subtitle: 'Venčavamo se 12. septembra 2026.',
        layout: 'centered',
        showIntroAnimation: true,
      }),
      section('names', 1, {
        primaryName: 'Milica',
        secondaryName: 'Stefan',
        connector: 'i',
        alignment: 'center',
      }),
      section('date_time', 2, { display: 'elegant', showDayName: true }),
      section('message', 3, {
        title: 'Dragi naši',
        body: 'Posle sedam godina zajedničkog života odlučili smo da kažemo „da”. Bilo bi nam mnogo lepše ako taj dan provedemo sa vama.',
        signature: 'Milica i Stefan',
        alignment: 'center',
      }),
      section('locations', 4, {
        title: 'Gde se okupljamo',
        layout: 'cards',
        locations: [
          {
            id: 'opstina',
            name: 'Opština Stari grad',
            address: 'Makedonska 42, Beograd',
            icon: 'building',
            time: '13:00',
            description: 'Svečana sala na prvom spratu.',
            parkingNote: 'Parking u Dečanskoj, pet minuta pešice.',
          },
          {
            id: 'restoran',
            name: 'Restoran Dunavski kej',
            address: 'Kej oslobođenja 18, Zemun',
            icon: 'restaurant',
            time: '19:00',
            description: 'Svadbena večera i muzika do jutra.',
          },
        ],
      }),
      section('schedule', 5, {
        title: 'Kako teče dan',
        style: 'timeline',
        items: [
          { id: 's1', time: '11:30', title: 'Kupovina bidermajera', icon: 'heart', description: '' },
          { id: 's2', time: '13:00', title: 'Venčanje u opštini', icon: 'building', description: '' },
          { id: 's3', time: '16:00', title: 'Fotografisanje na Kalemegdanu', icon: 'camera', description: '' },
          { id: 's4', time: '19:00', title: 'Svadbena večera', icon: 'restaurant', description: '' },
        ],
      }),
      section('rsvp', 6, {
        title: 'Javite nam da li dolazite',
        intro: 'Molimo vas da potvrdite dolazak do 15. avgusta.',
        deadline: '2026-08-15',
        askChildren: true,
        askMessage: true,
      }),
      section('footer', 7, { text: 'Radujemo se što ćemo vas videti.', showBranding: true }),
    ],
  },
  {
    slug: 'vencanje-botanicki',
    name: 'Romantični botanički',
    description:
      'Topli tonovi, listovi i mekana tipografija. Lepo izgleda uz fotografije iz prirode i vinograda.',
    eventTypeKey: 'wedding',
    themeKey: 'botanical-blush',
    style: 'romantic',
    dominantColor: '#fbf6f4',
    usesPhotos: true,
    isFeatured: true,
    requiredPlanCode: 'standard',
    sortOrder: 20,
    sections: [
      section('hero', 0, {
        eyebrow: 'Sa radošću vas pozivamo',
        title: 'Jovana i Nikola',
        subtitle: '30. maja 2026, Vršac',
        layout: 'full-bleed',
        overlayOpacity: 30,
      }),
      section('date_time', 1, { display: 'full', showDayName: true }),
      section('story', 2, {
        title: 'Naša priča',
        style: 'alternating',
        entries: [
          {
            id: 'e1',
            label: 'Jesen 2018.',
            title: 'Prvi susret',
            text: 'Upoznali smo se na proslavi rođendana zajedničke drugarice u Novom Sadu.',
          },
          {
            id: 'e2',
            label: 'Leto 2021.',
            title: 'Prvo putovanje',
            text: 'Dve nedelje na Peloponezu i odluka da ovo nije privremeno.',
          },
          {
            id: 'e3',
            label: 'Zima 2025.',
            title: 'Prosidba',
            text: 'Na Zlatiboru, uz sneg koji je padao ceo dan.',
          },
        ],
      }),
      section('locations', 3, {
        title: 'Mesta',
        layout: 'cards',
        locations: [
          {
            id: 'crkva',
            name: 'Crkva Svetog Nikole',
            address: 'Trg pobede 3, Vršac',
            icon: 'church',
            time: '15:00',
          },
          {
            id: 'salas',
            name: 'Salaš Vinogradi',
            address: 'Vršački put bb',
            icon: 'restaurant',
            time: '18:30',
            parkingNote: 'Veliki parking uz salaš.',
          },
        ],
      }),
      section('gallery', 4, { title: 'Nekoliko naših fotografija', layout: 'masonry', columns: 3 }),
      section('info_cards', 5, {
        title: 'Korisne informacije',
        columns: 2,
        cards: [
          { id: 'c1', icon: 'car', title: 'Prevoz', body: 'Autobus polazi ispred crkve u 17:45.' },
          { id: 'c2', icon: 'bed', title: 'Smeštaj', body: 'Rezervisali smo sobe u hotelu Srbija.' },
          { id: 'c3', icon: 'gift', title: 'Pokloni', body: 'Vaše prisustvo nam je najveći poklon.' },
          { id: 'c4', icon: 'baby', title: 'Deca', body: 'Deca su dobrodošla, imamo dečji sto.' },
        ],
      }),
      section('rsvp', 6, { title: 'Potvrda dolaska', deadline: '2026-04-30', askChildren: true }),
      section('footer', 7, { text: 'Vidimo se u Vršcu.', showBranding: true }),
    ],
  },

  // --- Krštenje ------------------------------------------------------------
  {
    slug: 'krstenje-maslinova-grancica',
    name: 'Maslinova grančica',
    description:
      'Nežan sakralni minimalizam u tonovima lana i masline. Za krštenje u užem krugu porodice.',
    eventTypeKey: 'christening',
    themeKey: 'sacral-linen',
    style: 'minimal',
    dominantColor: '#f8f7f3',
    usesPhotos: false,
    isFeatured: true,
    requiredPlanCode: 'free',
    sortOrder: 30,
    sections: [
      section('hero', 0, {
        eyebrow: 'Krštenje',
        title: 'Dunja',
        subtitle: '18. aprila 2026.',
        layout: 'centered',
      }),
      section('message', 1, {
        title: 'Dragi naši',
        body: 'Naša Dunja prima svetu tajnu krštenja. Pozivamo vas da taj dan podelite sa nama.',
        signature: 'Ana i Marko',
      }),
      section('locations', 2, {
        title: 'Gde i kada',
        layout: 'list',
        locations: [
          {
            id: 'hram',
            name: 'Hram Svetog Save',
            address: 'Krušedolska 2a, Beograd',
            icon: 'church',
            time: '11:00',
          },
          {
            id: 'rucak',
            name: 'Restoran Lipov lad',
            address: 'Bulevar Mihajla Pupina 10',
            icon: 'restaurant',
            time: '13:00',
          },
        ],
      }),
      section('people', 3, {
        title: 'Kum i kuma',
        layout: 'grid',
        showPhotos: false,
        people: [
          { id: 'p1', name: 'Ivana Petrović', role: 'Kuma' },
          { id: 'p2', name: 'Vladimir Jović', role: 'Kum' },
        ],
      }),
      section('rsvp', 4, { title: 'Potvrdite dolazak', askChildren: true }),
      section('footer', 5, { text: 'Hvala vam.', showBranding: true }),
    ],
  },
  {
    slug: 'krstenje-akvarel-oblaci',
    name: 'Akvarel oblaci',
    description:
      'Svetli plavi tonovi i mekani prelazi. Prijatna kombinacija za krštenje i mali porodični ručak.',
    eventTypeKey: 'christening',
    themeKey: 'cloud-watercolor',
    style: 'soft',
    dominantColor: '#f4f8fb',
    usesPhotos: true,
    isFeatured: false,
    requiredPlanCode: 'standard',
    sortOrder: 40,
    sections: [
      section('hero', 0, { eyebrow: 'Krštenje', title: 'Vukan', subtitle: '7. juna 2026.' }),
      section('date_time', 1, { display: 'stacked' }),
      section('locations', 2, {
        title: 'Mesta',
        layout: 'cards',
        locations: [
          {
            id: 'crkva',
            name: 'Crkva Rođenja Presvete Bogorodice',
            address: 'Njegoševa 25, Novi Sad',
            icon: 'church',
            time: '12:00',
          },
        ],
      }),
      section('gallery', 3, { title: 'Prvi meseci', layout: 'grid', columns: 3 }),
      section('rsvp', 4, { title: 'Dolazite li?', askChildren: true }),
      section('footer', 5, { text: '', showBranding: true }),
    ],
  },

  // --- Prvi rođendan -------------------------------------------------------
  {
    slug: 'prvi-rodjendan-medvedic',
    name: 'Medvedić',
    description:
      'Topla, vesela tema u boji meda. Prostor za mesečne fotografije i priču o prvoj godini.',
    eventTypeKey: 'first_birthday',
    themeKey: 'teddy-honey',
    style: 'playful',
    dominantColor: '#fdf7ef',
    usesPhotos: true,
    isFeatured: true,
    requiredPlanCode: 'free',
    sortOrder: 50,
    sections: [
      section('hero', 0, {
        eyebrow: 'Punim jednu godinu',
        title: 'Lena',
        subtitle: '9. avgusta 2026.',
        layout: 'framed',
      }),
      section('countdown', 1, { title: 'Još malo', style: 'boxes' }),
      section('story', 2, {
        title: 'Moja prva godina',
        style: 'timeline',
        entries: [
          { id: 'm1', label: 'Prvi mesec', title: 'Dobrodošla kući', text: 'Spavala sam mnogo.' },
          { id: 'm2', label: 'Šesti mesec', title: 'Prvi zub', text: 'I prvi grižljaj jabuke.' },
          { id: 'm3', label: 'Deseti mesec', title: 'Prvi koraci', text: 'Od kauča do stola.' },
        ],
      }),
      section('locations', 3, {
        title: 'Gde slavimo',
        layout: 'cards',
        locations: [
          {
            id: 'igraonica',
            name: 'Igraonica Balončić',
            address: 'Vojvode Stepe 122, Beograd',
            icon: 'balloon',
            time: '17:00',
            description: 'Animacija za decu i kafa za roditelje.',
          },
        ],
      }),
      section('gallery', 4, { title: 'Album', layout: 'grid', columns: 3 }),
      section('rsvp', 5, { title: 'Javite nam ko dolazi', askChildren: true }),
      section('footer', 6, { text: 'Vidimo se!', showBranding: true }),
    ],
  },
  {
    slug: 'prvi-rodjendan-pastelni-baloni',
    name: 'Pastelni baloni',
    description:
      'Zaobljeni oblici i pastelne boje. Lepo radi i bez fotografija, ako želite brzo gotovu pozivnicu.',
    eventTypeKey: 'first_birthday',
    themeKey: 'balloon-pastel',
    style: 'playful',
    dominantColor: '#fdf6f9',
    usesPhotos: false,
    isFeatured: false,
    requiredPlanCode: 'free',
    sortOrder: 60,
    sections: [
      section('hero', 0, { eyebrow: 'Prvi rođendan', title: 'Vasilije', subtitle: '3. oktobra 2026.' }),
      section('date_time', 1, { display: 'compact' }),
      section('locations', 2, {
        title: 'Gde',
        layout: 'list',
        locations: [
          {
            id: 'kuca',
            name: 'Kod bake i deke',
            address: 'Cara Dušana 14, Sremski Karlovci',
            icon: 'home',
            time: '16:00',
          },
        ],
      }),
      section('info_cards', 3, {
        title: 'Dobro je znati',
        columns: 2,
        cards: [
          { id: 'i1', icon: 'utensils', title: 'Hrana', body: 'Torta u 18h, posluženje ceo dan.' },
          { id: 'i2', icon: 'car', title: 'Parking', body: 'Slobodan parking u dvorištu.' },
        ],
      }),
      section('rsvp', 4, { title: 'Potvrda dolaska', askChildren: true }),
      section('footer', 5, { text: '', showBranding: true }),
    ],
  },

  // --- Punoletstvo ---------------------------------------------------------
  {
    slug: 'punoletstvo-crno-zlatna',
    name: 'Crno-zlatna',
    description:
      'Tamna, svečana tema sa zlatnim detaljima. Za proslavu u restoranu ili klubu.',
    eventTypeKey: 'coming_of_age',
    themeKey: 'midnight-velvet',
    style: 'luxury',
    dominantColor: '#151217',
    usesPhotos: true,
    isFeatured: true,
    requiredPlanCode: 'standard',
    sortOrder: 70,
    sections: [
      section('hero', 0, {
        eyebrow: 'Punim osamnaest',
        title: 'Teodora',
        subtitle: '21. novembra 2026.',
        layout: 'full-bleed',
        overlayOpacity: 45,
      }),
      section('countdown', 1, { title: 'Odbrojavanje', style: 'boxes', showSeconds: true }),
      section('locations', 2, {
        title: 'Mesto',
        layout: 'cards',
        locations: [
          {
            id: 'klub',
            name: 'Klub Terasa',
            address: 'Bulevar oslobođenja 76, Novi Sad',
            icon: 'glass',
            time: '21:00',
          },
        ],
      }),
      section('info_cards', 3, {
        title: 'Detalji',
        columns: 2,
        cards: [
          { id: 'd1', icon: 'sparkles', title: 'Dress code', body: 'Svečano, crno-zlatno ako ste raspoloženi.' },
          { id: 'd2', icon: 'camera', title: 'Fotografije', body: 'Foto ćošak radi cele večeri.' },
        ],
      }),
      section('gallery', 4, { title: 'Kroz godine', layout: 'carousel', columns: 3 }),
      section('rsvp', 5, { title: 'Dolaziš?', askChildren: false, allowMaybe: true }),
      section('footer', 6, { text: 'Vidimo se na terasi.', showBranding: true }),
    ],
  },
  {
    slug: 'punoletstvo-neon',
    name: 'Neon',
    description:
      'Tamna podloga i neonski akcenat. Energična pozivnica za veće društvo.',
    eventTypeKey: 'coming_of_age',
    themeKey: 'neon-night',
    style: 'modern',
    dominantColor: '#0f1117',
    usesPhotos: false,
    isFeatured: false,
    requiredPlanCode: 'premium',
    sortOrder: 80,
    sections: [
      section('hero', 0, { eyebrow: '18', title: 'Filip', subtitle: '5. decembra 2026.' }),
      section('countdown', 1, { title: 'Počinjemo za', style: 'inline' }),
      section('locations', 2, {
        title: 'Gde',
        layout: 'list',
        locations: [
          {
            id: 'prostor',
            name: 'Prostor 22',
            address: 'Karađorđeva 22, Beograd',
            icon: 'music',
            time: '22:00',
          },
        ],
      }),
      section('music', 3, { title: 'Zvuk večeri', source: 'library', showControls: true }),
      section('rsvp', 4, { title: 'Prijavi se', askChildren: false, allowMaybe: true }),
      section('footer', 5, { text: '', showBranding: false }),
    ],
  },
];
