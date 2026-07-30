/**
 * Greške autorizacije.
 *
 * `NotFoundError` se namerno koristi i kada resurs postoji ali korisnik nema
 * pristup: razlika između „ne postoji” i „nije tvoje” odaje postojanje tuđih
 * događaja (zaštita od IDOR-a, zahtev 24).
 */
export class AuthenticationError extends Error {
  readonly code = 'unauthenticated';

  constructor(message = 'Prijavite se da biste nastavili.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  readonly code = 'forbidden';

  constructor(message = 'Nemate dozvolu za ovu radnju.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'not_found';

  constructor(message = 'Traženi sadržaj ne postoji.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class LimitExceededError extends Error {
  readonly code = 'limit_exceeded';

  constructor(
    message: string,
    readonly details: { limit: number; current: number; feature: string },
  ) {
    super(message);
    this.name = 'LimitExceededError';
  }
}

export class ValidationError extends Error {
  readonly code = 'validation';

  constructor(
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Istovremena izmena istog sadržaja (zahtev 26).
 *
 * Nastaje kada uređivač pošalje izmenu zasnovanu na reviziji koja više nije
 * poslednja - npr. ista pozivnica je otvorena u dva prozora. Nosi trenutnu
 * reviziju da bi interfejs mogao da ponudi ponovno učitavanje bez pogađanja.
 */
export class ConflictError extends Error {
  readonly code = 'conflict';

  /**
   * Sukob stanja, ne unosa.
   *
   * Detalji su neobavezni jer nisu svi sukobi isti: uređivač šalje
   * `currentRevision` da bi forma znala na šta da se osloni, a zaključana
   * verzija rasporeda nema šta da doda - poruka je cela informacija.
   */
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function isKnownError(
  error: unknown,
): error is
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | LimitExceededError
  | ValidationError
  | ConflictError {
  return (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof NotFoundError ||
    error instanceof LimitExceededError ||
    error instanceof ValidationError ||
    error instanceof ConflictError
  );
}
