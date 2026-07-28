import { describe, expect, it } from 'vitest';

import {
  can,
  checkLimit,
  DEFAULT_PLANS,
  FEATURE_FLAGS,
  FEATURE_LIMITS,
  limitFor,
  planFeaturesSchema,
  type Entitlements,
} from '@/features/billing/entitlements';

const entitlementsFor = (code: keyof typeof DEFAULT_PLANS): Entitlements => ({
  planCode: code,
  planName: code,
  features: DEFAULT_PLANS[code],
});

describe('podrazumevani paketi', () => {
  it('svaki paket definiše sve zastavice i limite', () => {
    for (const [code, features] of Object.entries(DEFAULT_PLANS)) {
      const parsed = planFeaturesSchema.safeParse(features);
      expect(parsed.success, `Paket "${code}" ne prolazi šemu.`).toBe(true);

      for (const flag of FEATURE_FLAGS) {
        expect(features.flags[flag], `Paket "${code}" ne definiše zastavicu "${flag}".`).toBeTypeOf(
          'boolean',
        );
      }
      for (const limit of FEATURE_LIMITS) {
        expect(
          features.limits[limit],
          `Paket "${code}" ne definiše limit "${limit}".`,
        ).not.toBeUndefined();
      }
    }
  });

  it('besplatan paket ne dozvoljava objavljivanje', () => {
    expect(can(entitlementsFor('free'), 'publish')).toBe(false);
  });

  it('standard objavljuje, ali nema raspored sedenja', () => {
    expect(can(entitlementsFor('standard'), 'publish')).toBe(true);
    expect(can(entitlementsFor('standard'), 'seating')).toBe(false);
  });

  it('premium ima sve mogućnosti', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(can(entitlementsFor('premium'), flag), `Premium mora imati "${flag}".`).toBe(true);
    }
  });
});

describe('limitFor', () => {
  it('vraća brojčani limit', () => {
    expect(limitFor(entitlementsFor('free'), 'maxEvents')).toBe(3);
  });

  it('null znači neograničeno', () => {
    expect(limitFor(entitlementsFor('premium'), 'maxEvents')).toBeNull();
  });
});

describe('checkLimit', () => {
  it('dozvoljava dok se limit ne dostigne', () => {
    const result = checkLimit(entitlementsFor('free'), 'maxEvents', 2);
    expect(result).toEqual({ allowed: true, remaining: 0 });
  });

  it('odbija kada bi limit bio prekoračen', () => {
    const result = checkLimit(entitlementsFor('free'), 'maxEvents', 3);
    expect(result).toEqual({ allowed: false, limit: 3, current: 3 });
  });

  it('uzima u obzir traženu količinu', () => {
    const result = checkLimit(entitlementsFor('free'), 'maxEvents', 1, 3);
    expect(result.allowed).toBe(false);
  });

  it('neograničen limit uvek prolazi', () => {
    const result = checkLimit(entitlementsFor('premium'), 'maxEvents', 10_000);
    expect(result).toEqual({ allowed: true, remaining: null });
  });

  it('limit 0 znači da mogućnost nije dostupna', () => {
    const result = checkLimit(entitlementsFor('free'), 'maxCollaborators', 0);
    expect(result.allowed).toBe(false);
  });
});
