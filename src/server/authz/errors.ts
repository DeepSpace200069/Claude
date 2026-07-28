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

export function isKnownError(
  error: unknown,
): error is
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | LimitExceededError
  | ValidationError {
  return (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof NotFoundError ||
    error instanceof LimitExceededError ||
    error instanceof ValidationError
  );
}
