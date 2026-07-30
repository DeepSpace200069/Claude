import { describe, expect, it } from 'vitest';

import { checkFormNonce, issueFormNonce } from '@/lib/form-nonce';

/**
 * Potpisani ključ obrasca čuva javne forme od automatizovanog slanja.
 *
 * Testovi se drže onoga što ključ zaista obećava: da je obrazac izdala naša
 * stranica, da nije stigao brže nego što čovek može da kuca i da tuđi potpis ne
 * prolazi. Ne obećava zaštitu od napadača koji jednom učita stranicu - to je
 * posao za CAPTCHA i tako je i dokumentovano.
 */
const SCOPE = 'pozivnica:ana-i-marko';

describe('ključ obrasca', () => {
  it('prihvata sopstveni ključ posle kratkog čekanja', () => {
    const issuedAt = Date.now() - 5_000;
    const nonce = issueFormNonce(SCOPE, issuedAt);

    expect(checkFormNonce(SCOPE, nonce)).toBe('ok');
  });

  it('odbija slanje brže nego što čovek može da otkuca ime', () => {
    const nonce = issueFormNonce(SCOPE, Date.now());
    expect(checkFormNonce(SCOPE, nonce)).toBe('too_fast');
  });

  it('odbija ključ stariji od dvanaest sati', () => {
    const nonce = issueFormNonce(SCOPE, Date.now() - 13 * 60 * 60 * 1000);
    expect(checkFormNonce(SCOPE, nonce)).toBe('expired');
  });

  it('odbija ključ izdat za drugu pozivnicu', () => {
    const nonce = issueFormNonce('pozivnica:tudja-proslava', Date.now() - 5_000);
    expect(checkFormNonce(SCOPE, nonce)).toBe('invalid');
  });

  it('odbija izmenjeno vreme izdavanja', () => {
    // Napadač pomera vreme unapred da bi zaobišao donju granicu; potpis pada.
    const nonce = issueFormNonce(SCOPE, Date.now() - 5_000);
    const parts = nonce.split('.');
    const tampered = `${SCOPE}.${Date.now() - 60_000}.${parts[parts.length - 1]}`;

    expect(checkFormNonce(SCOPE, tampered)).toBe('invalid');
  });

  it('odbija izmišljen potpis', () => {
    expect(checkFormNonce(SCOPE, `${SCOPE}.${Date.now() - 5_000}.lazan-potpis`)).toBe(
      'invalid',
    );
  });

  it('odbija besmislicu umesto ključa', () => {
    expect(checkFormNonce(SCOPE, '')).toBe('invalid');
    expect(checkFormNonce(SCOPE, 'nema-tacke')).toBe('invalid');
  });
});
