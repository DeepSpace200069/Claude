/**
 * Pristanak na neobavezno čuvanje podataka u pregledaču (zahtev 29).
 *
 * Aplikacija namerno nema ni jedan reklamni ni trag koji prati ljude između
 * sajtova. Ono što stvarno postoji je popisano u `STORAGE_INVENTORY` i deli se
 * na dve grupe:
 *
 * - **neophodno** - bez toga usluga ne radi (sesija, zaštita od CSRF-a, dokaz
 *   o unetom PIN-u, izabrani jezik). Za to se pristanak ne traži, jer bez toga
 *   nema ni usluge koju je korisnik tražio;
 * - **merenje** - oznaka sesije po kojoj se posete razlikuju od ponovljenih.
 *   To se **ne** upisuje dok gost ne pristane.
 *
 * Pristanak se čuva u kolačiću i čita **u pregledaču**, a ne na serveru:
 * javna pozivnica je keširana ruta (zahtev 4.7), pa bi čitanje kolačića pri
 * renderovanju ukinulo keš za sve posetioce zbog trake koja se prikaže jednom.
 */
export const CONSENT_COOKIE = 'pozivnica_pristanak';

/** Verzija odluke - promena spiska kolačića mora ponovo da pita. */
export const CONSENT_VERSION = 1;

/** Šest meseci: dovoljno da traka ne dosađuje, dovoljno kratko da se odluka obnovi. */
export const CONSENT_MAX_AGE_DAYS = 180;

export type ConsentChoice = 'sve' | 'neophodno';

export type ConsentState = {
  version: number;
  choice: ConsentChoice;
  decidedAt: string;
};

/** Da li je merenje dozvoljeno. Bez odluke - nije. */
export function allowsMeasurement(state: ConsentState | null): boolean {
  return state?.choice === 'sve';
}

export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;

    if (parsed.version !== CONSENT_VERSION) return null;
    if (parsed.choice !== 'sve' && parsed.choice !== 'neophodno') return null;

    return {
      version: CONSENT_VERSION,
      choice: parsed.choice,
      decidedAt: parsed.decidedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice): string {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    choice,
    decidedAt: new Date().toISOString(),
  };

  return encodeURIComponent(JSON.stringify(state));
}

/** Čitanje odluke iz `document.cookie`; na serveru uvek `null`. */
export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));

  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

/**
 * Upis odluke.
 *
 * `SameSite=Lax` i bez `HttpOnly` - vrednost mora da bude čitljiva iz
 * pregledača, jer se tamo i primenjuje. U njoj nema ničega tajnog: samo koju je
 * dugmad korisnik pritisnuo i kada.
 */
export function writeConsentCookie(choice: ConsentChoice): ConsentState {
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';

  document.cookie = [
    `${CONSENT_COOKIE}=${serializeConsent(choice)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  return {
    version: CONSENT_VERSION,
    choice,
    decidedAt: new Date().toISOString(),
  };
}

export type StorageItem = {
  name: string;
  kind: 'kolačić' | 'localStorage' | 'sessionStorage';
  category: 'neophodno' | 'merenje';
  /** Ključ prevoda sa objašnjenjem čemu služi. */
  purposeKey: string;
  duration: string;
};

/**
 * Spisak svega što aplikacija upisuje u pregledač.
 *
 * Stranica o kolačićima se pravi **iz ovog spiska**, a ne iz ručno pisanog
 * teksta - tekst koji se piše zasebno zastari prvog dana kada neko doda
 * kolačić.
 */
export const STORAGE_INVENTORY: readonly StorageItem[] = [
  {
    name: 'authjs.session-token',
    kind: 'kolačić',
    category: 'neophodno',
    purposeKey: 'cookies.purposeSession',
    duration: '30 dana',
  },
  {
    name: 'authjs.csrf-token',
    kind: 'kolačić',
    category: 'neophodno',
    purposeKey: 'cookies.purposeCsrf',
    duration: 'do zatvaranja pregledača',
  },
  {
    name: 'pozivnica_locale',
    kind: 'kolačić',
    category: 'neophodno',
    purposeKey: 'cookies.purposeLocale',
    duration: '1 godina',
  },
  {
    name: 'pozivnica-pin-<pozivnica>',
    kind: 'kolačić',
    category: 'neophodno',
    purposeKey: 'cookies.purposePin',
    duration: '30 dana',
  },
  {
    name: CONSENT_COOKIE,
    kind: 'kolačić',
    category: 'neophodno',
    purposeKey: 'cookies.purposeConsent',
    duration: '6 meseci',
  },
  {
    name: 'pozivnica_favoriti',
    kind: 'localStorage',
    category: 'neophodno',
    purposeKey: 'cookies.purposeFavorites',
    duration: 'do brisanja iz pregledača',
  },
  {
    name: 'pozivnica-poseta-<pozivnica>',
    kind: 'sessionStorage',
    category: 'merenje',
    purposeKey: 'cookies.purposeVisit',
    duration: 'do zatvaranja kartice',
  },
];
