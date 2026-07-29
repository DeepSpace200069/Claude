import 'server-only';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from '@/server/authz/errors';

/**
 * Jedinstven oblik odgovora server akcija.
 *
 * Akcije ne bacaju izuzetke ka klijentu: Next bi ih u produkciji zamenio
 * generičkom porukom, pa bi korisnik ostao bez informacije šta da uradi. Umesto
 * toga vraćamo strukturu koju forma ume da prikaže uz odgovarajuće polje.
 */
export type ActionSuccess<T> = { ok: true; data: T };

export type ActionFailure = {
  ok: false;
  code:
    | 'unauthenticated'
    | 'forbidden'
    | 'not_found'
    | 'validation'
    | 'limit_exceeded'
    | 'rate_limited'
    | 'conflict'
    | 'unknown';
  message: string;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function success<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function failure(
  code: ActionFailure['code'],
  message: string,
  extra: Omit<ActionFailure, 'ok' | 'code' | 'message'> = {},
): ActionFailure {
  return { ok: false, code, message, ...extra };
}

/**
 * Prevodi poznate greške u odgovor akcije.
 *
 * Nepoznate greške se namerno ne prosleđuju korisniku - loguju se na serveru, a
 * korisnik dobija generičku poruku, da poruka baze ne bi procurela u interfejs.
 */
export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof ValidationError) {
    return failure('validation', error.message, {
      fieldErrors: error.fieldErrors,
    });
  }

  if (error instanceof AuthenticationError) {
    return failure('unauthenticated', error.message);
  }

  if (error instanceof AuthorizationError) {
    return failure('forbidden', error.message);
  }

  if (error instanceof NotFoundError) {
    return failure('not_found', error.message);
  }

  if (error instanceof LimitExceededError) {
    return failure('limit_exceeded', error.message, { details: error.details });
  }

  if (error instanceof ConflictError) {
    return failure('conflict', error.message, { details: error.details });
  }

  console.error('[action] Neočekivana greška:', error);
  return failure(
    'unknown',
    'Došlo je do neočekivane greške. Pokušajte ponovo za koji trenutak.',
  );
}

/** Pretvara Zod greške u oblik koji forma razume. */
export function zodFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
