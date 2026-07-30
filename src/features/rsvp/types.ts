/**
 * Tipovi RSVP-a i knjige želja koje dele server, javni prikaz i uređivač.
 *
 * Namerno bez ijednog uvoza: ovaj modul opisuje **oblik podataka**, a uvlače ga
 * i renderer sekcija i serverski servis. Da ima zavisnosti, javna stranica bi
 * kroz njega povukla kod koji joj ne treba (zahtev 39.10).
 */

export const RSVP_QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'boolean',
  'number',
  'text',
  'date',
] as const;

export type RsvpQuestionType = (typeof RSVP_QUESTION_TYPES)[number];

export type RsvpQuestionOption = {
  /**
   * Stabilan ključ opcije (`o1`, `o2`...).
   *
   * Namerno nije izveden iz teksta: organizator sme da preformuliše opciju, a
   * već poslati odgovori moraju da nastave da pokazuju na istu stvar.
   */
  value: string;
  label: string;
};

export type RsvpQuestionConfig = {
  options?: RsvpQuestionOption[];
  min?: number;
  max?: number;
  maxLength?: number;
};

export type RsvpQuestion = {
  id: string;
  type: RsvpQuestionType;
  label: string;
  helpText: string | null;
  isRequired: boolean;
  /** Pitanje se prikazuje samo gostima koji su rekli da dolaze. */
  attendingOnly: boolean;
  position: number;
  config: RsvpQuestionConfig;
};

export type RsvpAnswerValue = string | number | boolean | string[];

export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe';

/** Već poslat odgovor - forma se otvara popunjena, a ne prazna. */
export type ExistingRsvp = {
  status: RsvpStatus;
  fullName: string;
  email: string;
  phone: string;
  adultsCount: number;
  childrenCount: number;
  companions: string[];
  message: string;
  answers: Record<string, RsvpAnswerValue>;
  /** ISO oblik - kroz granicu server/klijent ide tekst, ne `Date`. */
  submittedAt: string;
  lastEditedAt: string | null;
};

export type GuestbookEntryView = {
  id: string;
  authorName: string;
  message: string;
  reaction: string | null;
  createdAt: string;
};

/**
 * Oblik odgovora javnih server akcija.
 *
 * Namerno opisan ovde, a ne uvezen iz `server/actions/result`: taj modul je
 * `server-only`, a ovaj tip putuje sve do forme u pregledaču.
 */
export type PublicActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type RsvpSubmitResult = {
  status: 'yes' | 'no' | 'maybe';
  isUpdate: boolean;
  /** Link za kasniju izmenu; postoji samo kada je odgovor upravo napravljen. */
  editUrl: string | null;
};

/**
 * Server akcije stižu do forme kao **prop**, a ne kroz `import`.
 *
 * To nije stilska sitnica: renderer sekcija se učitava i u uređivaču, pa bi
 * uvoz serverske akcije iz njega povukao ceo serverski graf u bundle pregleda
 * (zahtev 39.10). Ovako sekcija ostaje čist prikaz, a ko sme šta - zna server.
 */
export type SubmitRsvpFn = (
  input: unknown,
) => Promise<PublicActionResult<RsvpSubmitResult>>;

export type SubmitGuestbookFn = (
  input: unknown,
) => Promise<PublicActionResult<{ status: 'pending' | 'approved' }>>;

/**
 * Sve što interaktivnim sekcijama treba na pravoj pozivnici.
 *
 * `null` je u `preview` režimu: demo šablona i pregled u uređivaču nemaju gosta,
 * pa nemaju ni odgovor, ni token, ni ključ forme - i baš zato tamo forma stoji
 * onemogućena umesto da se pravi da radi (zahtev 39.9).
 */
export type LiveInteractionContext = {
  slug: string;
  /** Token ličnog linka, ako je gost stigao preko njega. */
  recipientToken: string | null;
  greetingName: string | null;
  /** Gornja granica broja osoba za ovaj link; `null` znači bez granice. */
  maxGuests: number | null;
  /** Potpisani ključ forme - zaštita od automatizovanog slanja. */
  formNonce: string;
  questions: RsvpQuestion[];
  existingResponse: ExistingRsvp | null;
  /** Token za kasniju izmenu, ako je gost stigao preko linka za izmenu. */
  editToken: string | null;
  guestbookEntries: GuestbookEntryView[];

  submitRsvp: SubmitRsvpFn;
  submitGuestbookEntry: SubmitGuestbookFn;
};
