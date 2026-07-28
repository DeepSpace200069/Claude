import type { Locale } from '@/i18n/config';

/**
 * Česta pitanja.
 *
 * Sadržaj, a ne elementi interfejsa - zato živi ovde, a ne u katalogu prevoda.
 * Pitanja se menjaju često i nezavisno od koda, a katalog treba da ostane skup
 * kratkih stringova interfejsa.
 */
export type FaqItem = { question: string; answer: string };

const SR_LATN: FaqItem[] = [
  {
    question: 'Da li mi treba nalog da bih napravio pozivnicu?',
    answer:
      'Za pravljenje i pregled ne treba vam ništa osim email adrese. Prijava ide linkom koji vam pošaljemo na email, bez lozinke. Nalog je potreban da bismo sačuvali vaš nacrt i kasnije vam pokazali ko je potvrdio dolazak.',
  },
  {
    question: 'Koliko košta?',
    answer:
      'Pravljenje pozivnice i pregled su besplatni. Plaća se jednom, po događaju, i to tek kada odlučite da je objavite. Nema pretplate i nema automatskog obnavljanja.',
  },
  {
    question: 'Mogu li da menjam pozivnicu pošto je objavim?',
    answer:
      'Da, i to je jedan od razloga zašto digitalna pozivnica ima smisla. Ako se promeni restoran ili vreme, izmenite pozivnicu i gosti odmah vide novu verziju. Link ostaje isti, pa ne morate ništa ponovo da šaljete.',
  },
  {
    question: 'Da li gosti moraju da se registruju da bi potvrdili dolazak?',
    answer:
      'Ne. Gost otvori link, popuni ime i broj osoba i to je sve. Ako mu kasnije nešto iskrsne, može da izmeni odgovor preko istog linka.',
  },
  {
    question: 'Ko vidi podatke mojih gostiju?',
    answer:
      'Samo vi i saradnici kojima sami date pristup. Odgovori na pozivnicu nisu javni, ne prikazujemo ih drugim gostima i ne koristimo ih ni za kakav marketing.',
  },
  {
    question: 'Šta ako neko pogodi moj link?',
    answer:
      'Pozivnica podrazumevano nije vidljiva pretraživačima. Ako želite dodatnu zaštitu, možete je zaključati PIN-om ili dozvoliti pristup samo gostima kojima ste poslali personalizovani link.',
  },
  {
    question: 'Mogu li da pošaljem pozivnicu preko Vibera ili WhatsAppa?',
    answer:
      'Da. Dobijate običan link koji možete zalepiti bilo gde - Viber, WhatsApp, SMS, email ili društvene mreže. Uz link ide i QR kod, koristan ako pozivnicu štampate uz nešto drugo.',
  },
  {
    question: 'Šta ako mi zatreba pomoć?',
    answer:
      'Pišite nam i javićemo se, obično u toku istog radnog dana. Ako nešto ne radi kako treba, to je naš problem, ne vaš.',
  },
];

const EN: FaqItem[] = [
  {
    question: 'Do I need an account to create an invitation?',
    answer:
      'All you need is an email address. Signing in works through a link we email you — no password. The account exists so we can save your draft and later show you who has replied.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'Building and previewing are free. You pay once, per event, and only when you decide to publish. No subscription and no automatic renewal.',
  },
  {
    question: 'Can I edit the invitation after publishing?',
    answer:
      'Yes — that is much of the point of a digital invitation. If the venue or time changes, edit it and your guests immediately see the new version. The link stays the same, so you do not have to resend anything.',
  },
  {
    question: 'Do guests have to register to reply?',
    answer:
      'No. A guest opens the link, fills in a name and the number of people, and that is it. If plans change, they can update their reply through the same link.',
  },
  {
    question: 'Who can see my guests’ details?',
    answer:
      'Only you and the collaborators you invite. Replies are not public, we never show them to other guests, and we do not use them for marketing.',
  },
  {
    question: 'What if someone guesses my link?',
    answer:
      'Invitations are hidden from search engines by default. For more protection you can lock the page with a PIN, or allow access only through personalised links you send to specific guests.',
  },
  {
    question: 'Can I share the invitation over Viber or WhatsApp?',
    answer:
      'Yes. You get an ordinary link you can paste anywhere — Viber, WhatsApp, SMS, email or social media. A QR code comes with it, which helps if you are printing something alongside.',
  },
  {
    question: 'What if I need help?',
    answer:
      'Write to us and we will get back to you, usually the same business day. If something is broken, that is our problem, not yours.',
  },
];

/**
 * Nemački i ćirilica se za sada oslanjaju na srpsku, odnosno englesku verziju.
 * Prevod je planiran; do tada stranica jasno kaže na kom je jeziku sadržaj,
 * umesto da prikaže prazno.
 */
const FAQ: Partial<Record<Locale, FaqItem[]>> = {
  'sr-Latn': SR_LATN,
  en: EN,
};

export function getFaq(locale: Locale): {
  items: FaqItem[];
  isFallback: boolean;
  fallbackLocale: Locale;
} {
  const exact = FAQ[locale];
  if (exact) return { items: exact, isFallback: false, fallbackLocale: locale };

  // Ćirilica pada na latinicu (isti jezik), ostalo na engleski.
  const fallbackLocale: Locale = locale === 'sr-Cyrl' ? 'sr-Latn' : 'en';
  return {
    items: FAQ[fallbackLocale] ?? SR_LATN,
    isFallback: true,
    fallbackLocale,
  };
}
