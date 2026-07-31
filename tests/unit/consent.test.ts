import { describe, expect, it } from 'vitest';

import {
  CONSENT_VERSION,
  STORAGE_INVENTORY,
  allowsMeasurement,
  parseConsent,
  serializeConsent,
} from '@/features/consent/consent';

/**
 * Pristanak (zahtev 29).
 *
 * Najvažnije pravilo je podrazumevano stanje: bez odluke se **ne** meri. Test
 * postoji da bi ta granica ostala takva i posle izmena oblika kolačića.
 */
describe('pristanak na merenje', () => {
  it('bez odluke merenje nije dozvoljeno', () => {
    expect(allowsMeasurement(null)).toBe(false);
  });

  it('„samo neophodno” ne dozvoljava merenje', () => {
    expect(allowsMeasurement(parseConsent(serializeConsent('neophodno')))).toBe(false);
  });

  it('„prihvati sve” dozvoljava merenje', () => {
    expect(allowsMeasurement(parseConsent(serializeConsent('sve')))).toBe(true);
  });

  it('vrednost se čita nazad u istom obliku', () => {
    const state = parseConsent(serializeConsent('sve'));

    expect(state?.choice).toBe('sve');
    expect(state?.version).toBe(CONSENT_VERSION);
    expect(Date.parse(state?.decidedAt ?? '')).not.toBeNaN();
  });

  it('pokvarena ili izmišljena vrednost se odbacuje', () => {
    expect(parseConsent('nije-json')).toBeNull();
    expect(parseConsent(encodeURIComponent('{"choice":"sve"}'))).toBeNull();
    expect(
      parseConsent(encodeURIComponent(JSON.stringify({ version: 1, choice: 'možda' }))),
    ).toBeNull();
  });

  it('starija verzija odluke se ne poštuje - pita se ponovo', () => {
    const stara = encodeURIComponent(
      JSON.stringify({ version: CONSENT_VERSION - 1, choice: 'sve' }),
    );

    expect(parseConsent(stara)).toBeNull();
  });

  it('prazan kolačić znači da odluke nema', () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('')).toBeNull();
  });
});

describe('spisak kolačića', () => {
  it('svaki upis u pregledač ima svrhu i trajanje', () => {
    for (const item of STORAGE_INVENTORY) {
      expect(item.name).not.toBe('');
      expect(item.purposeKey.startsWith('cookies.')).toBe(true);
      expect(item.duration).not.toBe('');
    }
  });

  it('merenje je jedina neobavezna kategorija', () => {
    const categories = new Set(STORAGE_INVENTORY.map((item) => item.category));
    expect([...categories].sort()).toEqual(['merenje', 'neophodno']);
  });

  it('oznaka posete je jedino što čeka pristanak', () => {
    const optional = STORAGE_INVENTORY.filter((item) => item.category === 'merenje');

    expect(optional).toHaveLength(1);
    expect(optional[0]?.kind).toBe('sessionStorage');
  });
});
