import type { Locale } from '@/i18n/config';

/**
 * Tekstovi interaktivnih sekcija na sva četiri jezika.
 *
 * Namerno **nisu** u glavnom katalogu prevoda, iz istog razloga kao kod
 * odbrojavanja: RSVP forma i knjiga želja su jedine sekcije sa JavaScriptom na
 * javnoj pozivnici, pa bi prosleđivanje celog kataloga do klijenta poništilo
 * trud oko veličine bundle-a (zahtev 32 i 39.10).
 *
 * Pozivnica se prikazuje na jeziku koji je organizator izabrao za događaj, a ne
 * na jeziku pregledača gosta - okvir forme mora da bude na istom jeziku kao
 * tekst koji je organizator uneo.
 */
export type RsvpLabels = {
  legend: string;
  previewNote: string;
  /** Sadrži `{date}`; popunjava se sa `fillLabel`. */
  deadline: string;
  closed: string;

  fullName: string;
  attending: string;
  yes: string;
  no: string;
  maybe: string;
  adults: string;
  children: string;
  companions: string;
  companionsHelp: string;
  addCompanion: string;
  removeCompanion: string;
  email: string;
  phone: string;
  contactHelp: string;
  message: string;
  submit: string;
  submitting: string;
  update: string;
  required: string;

  thanksYes: string;
  thanksNo: string;
  thanksMaybe: string;
  updated: string;
  editHint: string;
  editAgain: string;
  copyLink: string;
  copied: string;

  /** Sadrži `{count}`. */
  maxGuests: string;
  chooseOne: string;
  chooseMany: string;
  yesNo: string;
  errorGeneric: string;
};

export type GuestbookLabels = {
  legend: string;
  previewNote: string;
  authorName: string;
  message: string;
  reaction: string;
  noReaction: string;
  submit: string;
  submitting: string;
  thanksPending: string;
  thanksApproved: string;
  empty: string;
  /** Sadrži `{count}`. */
  charactersLeft: string;
  errorGeneric: string;
};

const SR_LATN: { rsvp: RsvpLabels; guestbook: GuestbookLabels } = {
  rsvp: {
    legend: 'Potvrda dolaska',
    previewNote: 'Ovako gost vidi formu. U demo prikazu odgovor se ne šalje.',
    deadline: 'Molimo vas da odgovorite do {date}.',
    closed: 'Rok za potvrdu dolaska je prošao. Javite se domaćinima direktno.',

    fullName: 'Ime i prezime',
    attending: 'Dolazite li?',
    yes: 'Dolazim',
    no: 'Ne dolazim',
    maybe: 'Još nisam siguran',
    adults: 'Broj odraslih',
    children: 'Broj dece',
    companions: 'Ko još dolazi sa vama',
    companionsHelp: 'Upišite imena osoba koje dolaze sa vama.',
    addCompanion: 'Dodaj osobu',
    removeCompanion: 'Ukloni',
    email: 'Email',
    phone: 'Telefon',
    contactHelp: 'Kontakt koristimo samo da vas obavestimo o izmenama.',
    message: 'Poruka domaćinima',
    submit: 'Pošalji odgovor',
    submitting: 'Šaljemo…',
    update: 'Sačuvaj izmenu',
    required: 'obavezno',

    thanksYes: 'Hvala! Vaš dolazak je zabeležen.',
    thanksNo: 'Hvala što ste javili. Nedostajaćete nam.',
    thanksMaybe: 'Hvala! Zabeležili smo da još niste sigurni.',
    updated: 'Vaš odgovor je izmenjen.',
    editHint:
      'Sačuvajte ovaj link ako kasnije budete želeli da izmenite odgovor. Šaljemo ga samo jednom.',
    editAgain: 'Izmeni odgovor',
    copyLink: 'Kopiraj link',
    copied: 'Link je kopiran.',

    maxGuests: 'Ovaj link važi za najviše {count} osoba.',
    chooseOne: 'Izaberite jednu opciju',
    chooseMany: 'Možete izabrati više opcija',
    yesNo: 'Da',
    errorGeneric: 'Odgovor nije poslat. Pokušajte ponovo za koji trenutak.',
  },
  guestbook: {
    legend: 'Ostavite poruku',
    previewNote: 'Ovako gost vidi formu. U demo prikazu poruka se ne šalje.',
    authorName: 'Vaše ime',
    message: 'Poruka',
    reaction: 'Reakcija',
    noReaction: 'Bez reakcije',
    submit: 'Pošalji poruku',
    submitting: 'Šaljemo…',
    thanksPending: 'Hvala! Poruka čeka da je domaćini odobre.',
    thanksApproved: 'Hvala! Vaša poruka je objavljena.',
    empty: 'Budite prvi koji ostavlja poruku.',
    charactersLeft: 'Preostalo znakova: {count}',
    errorGeneric: 'Poruka nije poslata. Pokušajte ponovo za koji trenutak.',
  },
};

const SR_CYRL: { rsvp: RsvpLabels; guestbook: GuestbookLabels } = {
  rsvp: {
    legend: 'Потврда доласка',
    previewNote: 'Овако гост види форму. У демо приказу одговор се не шаље.',
    deadline: 'Молимо вас да одговорите до {date}.',
    closed: 'Рок за потврду доласка је прошао. Јавите се домаћинима директно.',

    fullName: 'Име и презиме',
    attending: 'Долазите ли?',
    yes: 'Долазим',
    no: 'Не долазим',
    maybe: 'Још нисам сигуран',
    adults: 'Број одраслих',
    children: 'Број деце',
    companions: 'Ко још долази са вама',
    companionsHelp: 'Упишите имена особа које долазе са вама.',
    addCompanion: 'Додај особу',
    removeCompanion: 'Уклони',
    email: 'Имејл',
    phone: 'Телефон',
    contactHelp: 'Контакт користимо само да вас обавестимо о изменама.',
    message: 'Порука домаћинима',
    submit: 'Пошаљи одговор',
    submitting: 'Шаљемо…',
    update: 'Сачувај измену',
    required: 'обавезно',

    thanksYes: 'Хвала! Ваш долазак је забележен.',
    thanksNo: 'Хвала што сте јавили. Недостајаћете нам.',
    thanksMaybe: 'Хвала! Забележили смо да још нисте сигурни.',
    updated: 'Ваш одговор је измењен.',
    editHint:
      'Сачувајте овај линк ако касније будете желели да измените одговор. Шаљемо га само једном.',
    editAgain: 'Измени одговор',
    copyLink: 'Копирај линк',
    copied: 'Линк је копиран.',

    maxGuests: 'Овај линк важи за највише {count} особа.',
    chooseOne: 'Изаберите једну опцију',
    chooseMany: 'Можете изабрати више опција',
    yesNo: 'Да',
    errorGeneric: 'Одговор није послат. Покушајте поново за који тренутак.',
  },
  guestbook: {
    legend: 'Оставите поруку',
    previewNote: 'Овако гост види форму. У демо приказу порука се не шаље.',
    authorName: 'Ваше име',
    message: 'Порука',
    reaction: 'Реакција',
    noReaction: 'Без реакције',
    submit: 'Пошаљи поруку',
    submitting: 'Шаљемо…',
    thanksPending: 'Хвала! Порука чека да је домаћини одобре.',
    thanksApproved: 'Хвала! Ваша порука је објављена.',
    empty: 'Будите први који оставља поруку.',
    charactersLeft: 'Преостало знакова: {count}',
    errorGeneric: 'Порука није послата. Покушајте поново за који тренутак.',
  },
};

const EN: { rsvp: RsvpLabels; guestbook: GuestbookLabels } = {
  rsvp: {
    legend: 'RSVP',
    previewNote: 'This is how guests see the form. Nothing is sent in the demo.',
    deadline: 'Please reply by {date}.',
    closed: 'The RSVP deadline has passed. Please contact the hosts directly.',

    fullName: 'Full name',
    attending: 'Will you join us?',
    yes: 'I will be there',
    no: 'I cannot make it',
    maybe: 'Not sure yet',
    adults: 'Adults',
    children: 'Children',
    companions: 'Who is coming with you',
    companionsHelp: 'Add the names of the people joining you.',
    addCompanion: 'Add person',
    removeCompanion: 'Remove',
    email: 'Email',
    phone: 'Phone',
    contactHelp: 'We only use your contact details to tell you about changes.',
    message: 'Message to the hosts',
    submit: 'Send reply',
    submitting: 'Sending…',
    update: 'Save changes',
    required: 'required',

    thanksYes: 'Thank you! We have you on the list.',
    thanksNo: 'Thank you for letting us know. You will be missed.',
    thanksMaybe: 'Thank you! We noted that you are not sure yet.',
    updated: 'Your reply has been updated.',
    editHint:
      'Save this link if you may want to change your reply later. We show it only once.',
    editAgain: 'Edit reply',
    copyLink: 'Copy link',
    copied: 'Link copied.',

    maxGuests: 'This link is valid for up to {count} people.',
    chooseOne: 'Choose one option',
    chooseMany: 'You can choose more than one',
    yesNo: 'Yes',
    errorGeneric: 'Your reply was not sent. Please try again in a moment.',
  },
  guestbook: {
    legend: 'Leave a message',
    previewNote: 'This is how guests see the form. Nothing is sent in the demo.',
    authorName: 'Your name',
    message: 'Message',
    reaction: 'Reaction',
    noReaction: 'No reaction',
    submit: 'Send message',
    submitting: 'Sending…',
    thanksPending: 'Thank you! Your message is waiting for the hosts to approve it.',
    thanksApproved: 'Thank you! Your message is published.',
    empty: 'Be the first to leave a message.',
    charactersLeft: 'Characters left: {count}',
    errorGeneric: 'Your message was not sent. Please try again in a moment.',
  },
};

const DE: { rsvp: RsvpLabels; guestbook: GuestbookLabels } = {
  rsvp: {
    legend: 'Zusage',
    previewNote: 'So sehen Gäste das Formular. In der Demo wird nichts gesendet.',
    deadline: 'Bitte antworten Sie bis {date}.',
    closed: 'Die Frist ist abgelaufen. Bitte wenden Sie sich direkt an die Gastgeber.',

    fullName: 'Vor- und Nachname',
    attending: 'Sind Sie dabei?',
    yes: 'Ich komme',
    no: 'Ich kann nicht',
    maybe: 'Noch unsicher',
    adults: 'Erwachsene',
    children: 'Kinder',
    companions: 'Wer kommt mit',
    companionsHelp: 'Tragen Sie die Namen Ihrer Begleitung ein.',
    addCompanion: 'Person hinzufügen',
    removeCompanion: 'Entfernen',
    email: 'E-Mail',
    phone: 'Telefon',
    contactHelp: 'Wir nutzen Ihre Kontaktdaten nur für Änderungen zur Feier.',
    message: 'Nachricht an die Gastgeber',
    submit: 'Antwort senden',
    submitting: 'Wird gesendet…',
    update: 'Änderung speichern',
    required: 'Pflichtfeld',

    thanksYes: 'Danke! Wir haben Sie auf der Liste.',
    thanksNo: 'Danke für die Nachricht. Wir werden Sie vermissen.',
    thanksMaybe: 'Danke! Wir haben notiert, dass Sie noch unsicher sind.',
    updated: 'Ihre Antwort wurde geändert.',
    editHint:
      'Speichern Sie diesen Link, falls Sie Ihre Antwort später ändern möchten. Wir zeigen ihn nur einmal.',
    editAgain: 'Antwort ändern',
    copyLink: 'Link kopieren',
    copied: 'Link kopiert.',

    maxGuests: 'Dieser Link gilt für höchstens {count} Personen.',
    chooseOne: 'Wählen Sie eine Option',
    chooseMany: 'Mehrfachauswahl möglich',
    yesNo: 'Ja',
    errorGeneric: 'Die Antwort wurde nicht gesendet. Bitte versuchen Sie es erneut.',
  },
  guestbook: {
    legend: 'Nachricht hinterlassen',
    previewNote: 'So sehen Gäste das Formular. In der Demo wird nichts gesendet.',
    authorName: 'Ihr Name',
    message: 'Nachricht',
    reaction: 'Reaktion',
    noReaction: 'Keine Reaktion',
    submit: 'Nachricht senden',
    submitting: 'Wird gesendet…',
    thanksPending: 'Danke! Ihre Nachricht wartet auf die Freigabe der Gastgeber.',
    thanksApproved: 'Danke! Ihre Nachricht ist veröffentlicht.',
    empty: 'Hinterlassen Sie die erste Nachricht.',
    charactersLeft: 'Verbleibende Zeichen: {count}',
    errorGeneric: 'Die Nachricht wurde nicht gesendet. Bitte versuchen Sie es erneut.',
  },
};

/**
 * Oznake unutar sekcije lokacija.
 *
 * Renderer ih je do sada imao ispisane u kodu, na srpskom - pa je pozivnica na
 * engleskom prikazivala „Pristupačnost”. Isti razlog kao za RSVP: pozivnica
 * govori jezikom koji je organizator izabrao.
 */
export type LocationLabels = {
  parking: string;
  accessibility: string;
};

const LOCATION_LABELS: Record<Locale, LocationLabels> = {
  'sr-Latn': { parking: 'Parking', accessibility: 'Pristupačnost' },
  'sr-Cyrl': { parking: 'Паркинг', accessibility: 'Приступачност' },
  en: { parking: 'Parking', accessibility: 'Accessibility' },
  de: { parking: 'Parken', accessibility: 'Barrierefreiheit' },
};

export function locationLabels(locale: Locale): LocationLabels {
  return LOCATION_LABELS[locale] ?? LOCATION_LABELS['sr-Latn'];
}

const CATALOG: Record<Locale, { rsvp: RsvpLabels; guestbook: GuestbookLabels }> = {
  'sr-Latn': SR_LATN,
  'sr-Cyrl': SR_CYRL,
  en: EN,
  de: DE,
};

/**
 * Popunjava `{oznake}` u tekstu.
 *
 * Tekstovi su **obični stringovi**, nikad funkcije: ceo objekat prelazi granicu
 * server/klijent, a funkcija kroz nju ne može da prođe. Zamena se zato radi
 * ovde, na mestu prikaza.
 */
export function fillLabel(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function rsvpLabels(locale: Locale): RsvpLabels {
  return (CATALOG[locale] ?? SR_LATN).rsvp;
}

export function guestbookLabels(locale: Locale): GuestbookLabels {
  return (CATALOG[locale] ?? SR_LATN).guestbook;
}
