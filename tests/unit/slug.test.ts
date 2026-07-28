import { describe, expect, it } from 'vitest';

import {
  buildSlugCandidate,
  isReservedSlug,
  isValidSlug,
  MAX_SLUG_LENGTH,
  nextSlugCandidate,
  slugify,
} from '@/lib/slug';

describe('slugify', () => {
  it('pretvara srpsku latinicu u ASCII', () => {
    expect(slugify('Miloš i Đurđa')).toBe('milos-i-djurdja');
    expect(slugify('Čedomir Šarčević')).toBe('cedomir-sarcevic');
    expect(slugify('Žarko Ćirić')).toBe('zarko-ciric');
  });

  it('pretvara ćirilicu u ASCII', () => {
    expect(slugify('Милош и Ђурђа')).toBe('milos-i-djurdja');
    expect(slugify('Њега и Љубица')).toBe('njega-i-ljubica');
    expect(slugify('Џон и Шпела')).toBe('dzon-i-spela');
  });

  it('uklanja evropske dijakritike', () => {
    expect(slugify('Café Müller')).toBe('cafe-muller');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('sažima razmake i interpunkciju u jednu crticu', () => {
    expect(slugify('Ana   &   Marko!!!')).toBe('ana-marko');
    expect(slugify('  vodeci i prateci  ')).toBe('vodeci-i-prateci');
  });

  it('ne ostavlja crticu na kraju posle skraćivanja', () => {
    const long = `${'a'.repeat(MAX_SLUG_LENGTH - 1)} b`;
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(result.endsWith('-')).toBe(false);
  });

  it('vraća prazan string kada nema upotrebljivih znakova', () => {
    expect(slugify('🎉🎊')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('prihvata ispravne slugove', () => {
    expect(isValidSlug('milica-i-stefan')).toBe(true);
    expect(isValidSlug('ana2026')).toBe(true);
  });

  it('odbija neispravne oblike', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('-vodeca-crtica')).toBe(false);
    expect(isValidSlug('dvostruka--crtica')).toBe(false);
    expect(isValidSlug('Velika-Slova')).toBe(false);
    expect(isValidSlug('sa razmakom')).toBe(false);
    expect(isValidSlug('a'.repeat(MAX_SLUG_LENGTH + 1))).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('štiti sistemske rute', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('api')).toBe(true);
    expect(isReservedSlug('sabloni')).toBe(true);
    expect(isReservedSlug('login')).toBe(true);
  });

  it('dozvoljava obična imena', () => {
    expect(isReservedSlug('milica-i-stefan')).toBe(false);
  });
});

describe('buildSlugCandidate', () => {
  it('koristi naslov kada je upotrebljiv', () => {
    expect(buildSlugCandidate('Milica i Stefan')).toBe('milica-i-stefan');
  });

  it('dopunjava rezervisanu reč umesto da je odbaci', () => {
    expect(buildSlugCandidate('Admin')).toBe('admin-pozivnica');
  });

  it('pada na rezervnu vrednost kada naslov ne daje ništa', () => {
    expect(buildSlugCandidate('🎉', 'moja-proslava')).toBe('moja-proslava');
    expect(buildSlugCandidate('ab', 'moja-proslava')).toBe('moja-proslava');
  });
});

describe('nextSlugCandidate', () => {
  const fixedSuffix = () => 'x7k2m';

  it('prva dva pokušaja koriste čitljiv brojčani sufiks', () => {
    expect(nextSlugCandidate('ana-i-marko', 1, fixedSuffix)).toBe('ana-i-marko-2');
    expect(nextSlugCandidate('ana-i-marko', 2, fixedSuffix)).toBe('ana-i-marko-3');
  });

  it('kasniji pokušaji koriste nasumičan sufiks', () => {
    expect(nextSlugCandidate('ana-i-marko', 3, fixedSuffix)).toBe('ana-i-marko-x7k2m');
  });

  it('rezultat nikad ne prelazi najveću dozvoljenu dužinu', () => {
    const base = 'a'.repeat(MAX_SLUG_LENGTH);
    const result = nextSlugCandidate(base, 5, fixedSuffix);
    expect(result.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(isValidSlug(result)).toBe(true);
  });
});
