import { brand } from '@/config/brand';
import type { Locale } from '@/i18n/config';

/**
 * Pravni dokumenti.
 *
 * Sadržaj je pisan prema onome što aplikacija **stvarno** radi: koje podatke
 * prikuplja, koliko ih čuva i ko im pristupa. Nije prepisan opšti obrazac.
 *
 * Ipak, ovo je radna verzija - pre puštanja u rad treba da je pregleda pravnik
 * i uskladi sa Zakonom o zaštiti podataka o ličnosti i sa stvarnim podacima
 * privrednog društva. Stranica to i kaže korisniku, umesto da se pravi da je
 * dokument gotov.
 */
export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDocument = {
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

const TERMS_SR_LATN: LegalDocument = {
  updatedAt: '2026-07-28',
  intro: `Ovi uslovi uređuju korišćenje usluge ${brand.name} za pravljenje i deljenje digitalnih pozivnica. Korišćenjem usluge prihvatate ih u celini.`,
  sections: [
    {
      heading: 'Šta usluga radi',
      paragraphs: [
        `${brand.name} vam omogućava da napravite digitalnu pozivnicu, objavite je na javnom linku i pratite potvrde dolaska gostiju.`,
        'Pravljenje pozivnice i njen pregled su besplatni. Objavljivanje se naplaćuje jednokratno, po događaju, prema cenovniku koji važi u trenutku kupovine.',
      ],
    },
    {
      heading: 'Nalog',
      paragraphs: [
        'Za čuvanje pozivnice potreban je nalog vezan za vašu email adresu. Prijava se obavlja linkom koji šaljemo na tu adresu.',
        'Odgovorni ste za pristup svom email sandučetu. Ako izgubite pristup, izgubićete i mogućnost prijave na nalog.',
        'Nalog je namenjen fizičkim licima starijim od 18 godina, odnosno pravnim licima preko ovlašćenog lica.',
      ],
    },
    {
      heading: 'Vaš sadržaj',
      paragraphs: [
        'Tekst, fotografije i ostali sadržaj koji unosite ostaju vaši. Dajete nam samo pravo da ih čuvamo i prikazujemo u okviru vaše pozivnice, isključivo radi pružanja usluge.',
        'Odgovarate za to da imate pravo da koristite sadržaj koji otpremate, uključujući fotografije osoba koje se na njima nalaze.',
        'Nije dozvoljen sadržaj koji je protivzakonit, uvredljiv, koji krši tuđa autorska prava ili je namenjen obmani. Takav sadržaj možemo ukloniti, a pozivnicu deaktivirati.',
      ],
    },
    {
      heading: 'Podaci gostiju',
      paragraphs: [
        'Kada gost potvrdi dolazak, njegove podatke obrađujemo u vaše ime. Vi ste rukovalac tim podacima, a mi obrađivač.',
        'Podatke gostiju ne koristimo za marketing, ne prodajemo ih i ne ustupamo trećim licima osim tehničkim dobavljačima neophodnim za rad usluge.',
        'Obavezujete se da podatke gostiju koristite samo za organizaciju svoje proslave.',
      ],
    },
    {
      heading: 'Plaćanje i povraćaj',
      paragraphs: [
        'Objavljivanje se plaća unapred. Javni link se aktivira nakon evidentirane uplate.',
        'Ako usluga ne radi kako je opisano, a problem ne možemo da otklonimo, imate pravo na povraćaj uplaćenog iznosa. Zahtev pošaljite na ' +
          brand.supportEmail +
          '.',
        'Povraćaj ne pokriva slučaj da je proslava otkazana ili odložena iz razloga koji nisu vezani za rad usluge.',
      ],
    },
    {
      heading: 'Dostupnost usluge',
      paragraphs: [
        'Trudimo se da usluga radi neprekidno, ali ne možemo garantovati potpunu dostupnost. Planirana održavanja najavljujemo unapred kada je to moguće.',
        'Ne odgovaramo za štetu nastalu zbog privremene nedostupnosti, osim u meri u kojoj je to zakonom propisano.',
      ],
    },
    {
      heading: 'Prestanak korišćenja',
      paragraphs: [
        'Nalog možete obrisati u svakom trenutku. Brisanjem naloga brišu se i vaši događaji i podaci gostiju.',
        'Možemo ukinuti pristup nalogu koji krši ove uslove, uz prethodno obaveštenje osim kada je reč o očiglednoj zloupotrebi.',
      ],
    },
    {
      heading: 'Izmene uslova',
      paragraphs: [
        'Uslove možemo menjati. O značajnim izmenama obaveštavamo vas emailom najmanje 15 dana unapred.',
        'Ako se sa izmenama ne slažete, možete prestati da koristite uslugu i obrisati nalog.',
      ],
    },
  ],
};

const PRIVACY_SR_LATN: LegalDocument = {
  updatedAt: '2026-07-28',
  intro: `Ova politika objašnjava koje podatke ${brand.name} prikuplja, zašto ih prikuplja i koliko ih čuva. Pisana je da bude razumljiva, a ne da bude duga.`,
  sections: [
    {
      heading: 'Podaci koje prikupljamo od organizatora',
      paragraphs: [
        'Email adresu - potrebna je za prijavu i za obaveštenja o vašem događaju.',
        'Ime, ako ga unesete u profil. Nije obavezno.',
        'Sadržaj pozivnice: imena, datume, lokacije, tekstove i fotografije koje sami unosite.',
        'Jezik interfejsa i podešavanja obaveštenja.',
      ],
    },
    {
      heading: 'Podaci koje prikupljamo od gostiju',
      paragraphs: [
        'Ime koje gost unese pri potvrdi dolaska, broj osoba i, ako organizator to traži, odgovore na dodatna pitanja.',
        'Poruku organizatoru, ako je gost ostavi.',
        'Gost ne mora da napravi nalog i ne tražimo mu ništa što nije neophodno za potvrdu dolaska.',
        'Gost ne mora da pristane ni na kakav marketing da bi odgovorio na pozivnicu.',
      ],
    },
    {
      heading: 'Šta ne radimo',
      paragraphs: [
        'Ne prodajemo podatke i ne ustupamo ih oglašivačima.',
        'Ne koristimo podatke gostiju za marketing bez njihove izričite i posebne saglasnosti.',
        'Ne postavljamo kolačiće za praćenje. Kolačići koje koristimo su neophodni za prijavu i za pamćenje izabranog jezika.',
      ],
    },
    {
      heading: 'Statistika poseta',
      paragraphs: [
        'Za svaku objavljenu pozivnicu čuvamo dnevni zbir otvaranja, broj jedinstvenih posetilaca i broj odgovora.',
        'Čuvamo samo zbirne brojeve po danu. Ne beležimo pojedinačne posete, IP adrese posetilaca niti bilo šta čime bi se gost mogao identifikovati.',
      ],
    },
    {
      heading: 'Ko ima pristup',
      paragraphs: [
        'Vi, kao organizator, i saradnici kojima sami date pristup - u obimu dozvola koje im dodelite.',
        'Naš tehnički tim, samo kada je to neophodno za održavanje usluge ili za rešavanje prijavljenog problema. Takvi pristupi se beleže.',
        'Tehnički dobavljači koje koristimo: provajder baze podataka, provajder za slanje email poruka i provajder za skladištenje fotografija. Svi obrađuju podatke po našem nalogu.',
      ],
    },
    {
      heading: 'Koliko dugo čuvamo podatke',
      paragraphs: [
        'Podatke o događaju i gostima čuvamo dok postoji vaš nalog, a najduže godinu dana nakon datuma događaja.',
        'Po isteku tog roka podaci gostiju se brišu ili anonimizuju.',
        'Podatke o plaćanju čuvamo onoliko koliko nalažu poreski propisi.',
      ],
    },
    {
      heading: 'Vaša prava',
      paragraphs: [
        'Imate pravo da zatražite kopiju svojih podataka, ispravku netačnih podataka i brisanje naloga.',
        'Nalog i sve povezane podatke možete obrisati sami. Do trenutka dok ta opcija ne bude dostupna u interfejsu, zahtev pošaljite na ' +
          brand.supportEmail +
          ' i obradićemo ga u roku od 30 dana.',
        'Ako smatrate da vaše podatke obrađujemo nezakonito, možete se obratiti Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti.',
      ],
    },
    {
      heading: 'Bezbednost',
      paragraphs: [
        'Saobraćaj je šifrovan, a pristup tuđim događajima blokiran na nivou servera, ne samo u interfejsu.',
        'Tokeni koje šaljemo gostima su kriptografski nepredvidivi i čuvaju se isključivo u vidu heša.',
        'Nijedan sistem nije potpuno bezbedan. Ako dođe do incidenta koji ugrožava vaše podatke, obavestićemo vas bez odlaganja.',
      ],
    },
    {
      heading: 'Kontakt',
      paragraphs: [
        `Za sva pitanja o podacima pišite na ${brand.supportEmail}.`,
      ],
    },
  ],
};

const TERMS: Partial<Record<Locale, LegalDocument>> = { 'sr-Latn': TERMS_SR_LATN };
const PRIVACY: Partial<Record<Locale, LegalDocument>> = { 'sr-Latn': PRIVACY_SR_LATN };

export type LegalResult = { document: LegalDocument; isFallback: boolean };

export function getTerms(locale: Locale): LegalResult {
  const exact = TERMS[locale];
  return exact
    ? { document: exact, isFallback: false }
    : { document: TERMS_SR_LATN, isFallback: true };
}

export function getPrivacy(locale: Locale): LegalResult {
  const exact = PRIVACY[locale];
  return exact
    ? { document: exact, isFallback: false }
    : { document: PRIVACY_SR_LATN, isFallback: true };
}
