/**
 * Izvorni katalog poruka (srpski, latinica).
 *
 * Ovaj fajl je izvor istine za tipove prevoda: svi ostali jezici moraju da
 * poštuju isti oblik, a nedostajući ključevi padaju na ovaj katalog.
 */
const messages = {
  brand: {
    tagline: 'Digitalne pozivnice koje se pamte',
    description:
      'Napravite elegantnu pozivnicu za venčanje, krštenje ili rođendan, podelite je linkom i pratite potvrde dolaska na jednom mestu.',
  },

  common: {
    save: 'Sačuvaj',
    saving: 'Čuvanje…',
    saved: 'Sačuvano',
    cancel: 'Otkaži',
    delete: 'Obriši',
    edit: 'Izmeni',
    back: 'Nazad',
    next: 'Dalje',
    finish: 'Završi',
    continue: 'Nastavi',
    close: 'Zatvori',
    confirm: 'Potvrdi',
    loading: 'Učitavanje…',
    search: 'Pretraga',
    filter: 'Filter',
    all: 'Sve',
    none: 'Ništa',
    yes: 'Da',
    no: 'Ne',
    optional: 'opciono',
    required: 'obavezno',
    copy: 'Kopiraj',
    copied: 'Kopirano',
    open: 'Otvori',
    preview: 'Pregled',
    more: 'Još',
    retry: 'Pokušaj ponovo',
  },

  nav: {
    home: 'Početna',
    templates: 'Šabloni',
    howItWorks: 'Kako funkcioniše',
    pricing: 'Cenovnik',
    faq: 'Česta pitanja',
    contact: 'Kontakt',
    login: 'Prijava',
    logout: 'Odjava',
    dashboard: 'Kontrolni panel',
    events: 'Moji događaji',
    profile: 'Profil',
    admin: 'Administracija',
    terms: 'Uslovi korišćenja',
    privacy: 'Politika privatnosti',
    openMenu: 'Otvori meni',
    closeMenu: 'Zatvori meni',
    skipToContent: 'Pređi na sadržaj',
    language: 'Jezik',
  },

  marketing: {
    heroTitle: 'Pozivnica koju gosti otvore sa telefona',
    heroSubtitle:
      'Izaberite šablon, unesite podatke i podelite link. Bez dizajnera, bez štampe, bez čekanja.',
    heroCta: 'Napravi pozivnicu',
    heroSecondaryCta: 'Pogledaj šablone',
    heroNote: 'Pravljenje i pregled su besplatni. Plaća se tek objavljivanje.',
    stepsTitle: 'Od ideje do poslatog linka',
    stepsSubtitle: 'Ceo proces traje koliko i jedna kafa.',
    step1Title: 'Izaberite vrstu proslave',
    step1Text:
      'Venčanje, krštenje, prvi rođendan, punoletstvo ili neka druga proslava.',
    step2Title: 'Uredite pozivnicu',
    step2Text:
      'Dodajte satnicu, lokacije, galeriju i priču. Sve vidite uživo dok kucate.',
    step3Title: 'Podelite link',
    step3Text:
      'Pošaljite pozivnicu preko Vibera, WhatsAppa ili poruke i pratite ko dolazi.',
    featuresTitle: 'Sve što vam treba na jednom mestu',
    featureBuilderTitle: 'Modularni uređivač',
    featureBuilderText:
      'Sekcije dodajete, pomerate i uklanjate kako vam odgovara. Pozivnica prati vašu priču, a ne obrnuto.',
    featureRsvpTitle: 'Potvrde dolaska',
    featureRsvpText:
      'Gosti odgovaraju bez naloga. Vi u svakom trenutku znate koliko dolazi odraslih i dece.',
    featureSeatingTitle: 'Raspored sedenja',
    featureSeatingText:
      'Napravite stolove i prevucite goste na svoja mesta. Kapacitet se računa sam.',
    featureLinkTitle: 'Link koji se ne menja',
    featureLinkText:
      'Promenili ste restoran ili vreme? Izmenite pozivnicu, link ostaje isti.',
    categoriesTitle: 'Za svaku proslavu',
    categoriesSubtitle: 'Šabloni napravljeni za konkretan povod.',
    finalCtaTitle: 'Napravite pozivnicu večeras',
    finalCtaText: 'Prvi nacrt je besplatan i ostaje sačuvan u vašem nalogu.',
    footerRights: 'Sva prava zadržana.',
    footerProduct: 'Proizvod',
    footerCompany: 'Informacije',
    footerLegal: 'Pravno',
  },

  auth: {
    loginTitle: 'Prijava',
    loginSubtitle: 'Pošaljemo vam link za prijavu na email. Bez lozinke.',
    emailLabel: 'Email adresa',
    emailPlaceholder: 'vase.ime@primer.rs',
    sendMagicLink: 'Pošalji link za prijavu',
    sendingMagicLink: 'Slanje…',
    magicLinkSentTitle: 'Proverite email',
    magicLinkSentText:
      'Poslali smo link za prijavu na {email}. Link važi 24 sata.',
    orContinueWith: 'ili nastavite preko',
    googleButton: 'Nastavi preko Google naloga',
    termsNotice:
      'Prijavom prihvatate uslove korišćenja i politiku privatnosti.',
    signOut: 'Odjavi se',
    errorTitle: 'Prijava nije uspela',
    errorGeneric: 'Došlo je do greške pri prijavi. Pokušajte ponovo.',
    errorExpiredLink:
      'Link za prijavu je istekao ili je već iskorišćen. Zatražite novi.',
    errorAccessDenied: 'Pristup je odbijen.',
    requiredTitle: 'Potrebna je prijava',
    requiredText: 'Prijavite se da biste nastavili.',
  },

  eventTypes: {
    wedding: 'Venčanje',
    weddingChristening: 'Venčanje i krštenje',
    christening: 'Krštenje',
    firstBirthday: 'Prvi rođendan',
    birthday: 'Rođendan',
    comingOfAge: 'Punoletstvo',
    other: 'Ostalo',
  },

  events: {
    title: 'Moji događaji',
    subtitle: 'Sve vaše pozivnice na jednom mestu.',
    createButton: 'Novi događaj',
    emptyTitle: 'Još nemate nijedan događaj',
    emptyText:
      'Napravite prvi događaj i za nekoliko minuta imaćete pozivnicu spremnu za slanje.',
    emptyCta: 'Napravi prvu pozivnicu',
    countLabel: {
      one: '{count} događaj',
      few: '{count} događaja',
      other: '{count} događaja',
    },
    openDashboard: 'Otvori',
    deleteTitle: 'Brisanje događaja',
    deleteConfirm:
      'Događaj „{name}” i svi povezani podaci o gostima biće trajno obrisani. Ova radnja se ne može poništiti.',
    deleted: 'Događaj je obrisan.',
    created: 'Događaj je napravljen.',
    updated: 'Izmene su sačuvane.',
    notFound: 'Događaj ne postoji ili nemate pristup.',
  },

  eventStatus: {
    draft: 'Nacrt',
    published: 'Objavljeno',
    archived: 'Arhivirano',
  },

  wizard: {
    title: 'Nova pozivnica',
    stepOf: 'Korak {current} od {total}',
    step1Title: 'Kakva je proslava?',
    step1Subtitle: 'Izbor određuje koja polja i koji šabloni vam se nude.',
    step2Title: 'Osnovni podaci',
    step2Subtitle: 'Uvek možete da ih promenite kasnije.',
    step3Title: 'Izaberite izgled',
    step3Subtitle: 'Šablon je početna tačka, a ne konačna odluka.',
    createDraft: 'Napravi nacrt',
    creating: 'Pravimo pozivnicu…',
  },

  eventFields: {
    partner1: 'Ime prve osobe',
    partner2: 'Ime druge osobe',
    celebrant: 'Ime slavljenika',
    childName: 'Ime deteta',
    parentNames: 'Imena roditelja',
    birthDate: 'Datum rođenja',
    eventDate: 'Datum proslave',
    startTime: 'Vreme početka',
    city: 'Grad',
    venue: 'Glavna lokacija',
    invitationTitle: 'Naslov pozivnice',
    coverPhoto: 'Naslovna fotografija',
    timeZone: 'Vremenska zona',
    internalName: 'Interni naziv',
    internalNameHint: 'Vidite ga samo vi, radi lakšeg snalaženja u listi.',
    turningAge: 'Koji rođendan se slavi',
    guestCountEstimate: 'Očekivani broj gostiju',
  },

  dashboard: {
    title: 'Kontrolni panel',
    greeting: 'Dobro došli, {name}',
    greetingAnonymous: 'Dobro došli',
    daysLeft: {
      one: 'Još {count} dan',
      few: 'Još {count} dana',
      other: 'Još {count} dana',
    },
    today: 'Danas je veliki dan',
    past: 'Događaj je prošao',
    statusLabel: 'Status pozivnice',
    eventDate: 'Datum događaja',
    views: 'Pregleda',
    responses: 'Odgovora',
    confirmed: 'Potvrđeno',
    adults: 'Odraslih',
    children: 'Dece',
    declined: 'Odbilo',
    pending: 'Bez odgovora',
    quickActions: 'Prečice',
    openEditor: 'Uredi pozivnicu',
    openGuests: 'Gosti',
    openRsvp: 'Odgovori',
    openSeating: 'Raspored sedenja',
    openSettings: 'Podešavanja',
    copyLink: 'Kopiraj link',
    activityTitle: 'Poslednje aktivnosti',
    activityEmpty: 'Još nema aktivnosti.',
    notPublishedTitle: 'Pozivnica još nije objavljena',
    notPublishedText:
      'Uredite sadržaj, pogledajte kako izgleda i objavite je kada budete spremni.',
  },

  settings: {
    title: 'Podešavanja događaja',
    generalTitle: 'Osnovno',
    generalSubtitle: 'Naziv, datum i lokacija događaja.',
    dangerTitle: 'Opasna zona',
    dangerSubtitle: 'Radnje koje se ne mogu poništiti.',
    deleteEvent: 'Obriši događaj',
  },

  profile: {
    title: 'Profil',
    subtitle: 'Podaci o nalogu i podešavanja obaveštenja.',
    nameLabel: 'Ime i prezime',
    emailLabel: 'Email adresa',
    emailHint: 'Email adresa se koristi za prijavu i ne može se menjati ovde.',
    localeLabel: 'Jezik interfejsa',
    notificationsTitle: 'Obaveštenja',
    notificationsSubtitle: 'Vi birate koliko često želite da vas obaveštavamo.',
    notifyImmediate: 'Odmah po svakom odgovoru',
    notifyDaily: 'Dnevni rezime',
    notifyWeekly: 'Nedeljni rezime',
    notifyNever: 'Bez obaveštenja o odgovorima',
    dataTitle: 'Vaši podaci',
    dataSubtitle:
      'Možete preuzeti kopiju svojih podataka ili trajno obrisati nalog.',
    dataComingSoon:
      'Preuzimanje i brisanje podataka biće dostupni uskoro. Do tada nam pišite i obradićemo zahtev ručno.',
    downloadData: 'Preuzmi moje podatke',
    deleteAccount: 'Obriši nalog',
    saved: 'Profil je sačuvan.',
  },

  validation: {
    required: 'Ovo polje je obavezno.',
    tooShort: 'Unesite najmanje {min} znaka.',
    tooLong: 'Dozvoljeno je najviše {max} znakova.',
    invalidEmail: 'Unesite ispravnu email adresu.',
    invalidDate: 'Unesite ispravan datum.',
    invalidTime: 'Unesite ispravno vreme u formatu ČČ:MM.',
    invalidUrl: 'Unesite ispravan link.',
    dateInPast: 'Datum ne može biti u prošlosti.',
    numberMin: 'Vrednost mora biti najmanje {min}.',
    numberMax: 'Vrednost može biti najviše {max}.',
    invalidChoice: 'Izaberite jednu od ponuđenih opcija.',
  },

  errors: {
    genericTitle: 'Nešto je pošlo naopako',
    genericText:
      'Došlo je do neočekivane greške. Pokušajte ponovo za koji trenutak.',
    notFoundTitle: 'Stranica nije pronađena',
    notFoundText: 'Link je možda pogrešan ili je stranica uklonjena.',
    forbiddenTitle: 'Nemate pristup',
    forbiddenText: 'Ovaj sadržaj pripada drugom nalogu.',
    backHome: 'Nazad na početnu',
    rateLimited: 'Previše pokušaja. Sačekajte malo pa probajte ponovo.',
    unauthorized: 'Prijavite se da biste nastavili.',
  },

  plans: {
    free: 'Besplatan nacrt',
    standard: 'Standard',
    premium: 'Premium',
    currentPlan: 'Trenutni paket',
    upgrade: 'Nadogradi',
    limitReachedTitle: 'Dostignut limit paketa',
    limitReachedText:
      'Vaš paket „{plan}” dozvoljava najviše {limit}. Nadogradite paket da nastavite.',
    featureLockedText: 'Ova mogućnost je dostupna u paketu {plan}.',
  },
} as const;

export default messages;
