import { describe, expect, it } from 'vitest';

import {
  defaultFieldValues,
  fieldDefinitionsSchema,
  groupedFields,
  localized,
  validateFieldValues,
  type FieldDefinitions,
} from '@/features/templates/html-schema';

/**
 * Ugovor HTML šablona (zahtev 7).
 *
 * Isti modul koristi uvoznik, uređivač i javni prikaz, pa greška ovde ne bi
 * bila greška jedne stranice nego celog toka. Zato se proverava ono što svaka
 * od tri strane pretpostavlja: da su ključevi jedinstveni, da grupe postoje, da
 * obavezna polja zaista moraju da se popune i da nepoznat ključ ne ruši ništa.
 */
const definitions: FieldDefinitions = {
  groups: [
    { key: 'osnovno', label: { 'sr-Latn': 'Osnovno', en: 'Basics' } },
    { key: 'prica', label: { 'sr-Latn': 'Priča' } },
  ],
  fields: [
    {
      key: 'imeMlade',
      type: 'text',
      group: 'osnovno',
      label: { 'sr-Latn': 'Ime mlade', en: 'Bride’s name' },
      required: true,
      default: 'Ana',
      bind: [{ kind: 'text', selector: '[data-field="imeMlade"]' }],
    },
    {
      key: 'datum',
      type: 'date',
      group: 'osnovno',
      label: { 'sr-Latn': 'Datum' },
      required: true,
      default: '2026-09-12',
      bind: [{ kind: 'script', file: 'js/countdown.js', token: '{{datum}}' }],
    },
    {
      key: 'nasaPrica',
      type: 'longtext',
      group: 'prica',
      label: { 'sr-Latn': 'Naša priča' },
      required: false,
      default: '',
      maxLength: 20,
      bind: [{ kind: 'text', selector: '#prica p' }],
    },
    {
      key: 'link',
      type: 'url',
      group: 'prica',
      label: { 'sr-Latn': 'Link' },
      required: false,
      default: '',
      bind: [{ kind: 'attr', selector: '#prica a', attr: 'href' }],
    },
  ],
};

describe('definicije polja', () => {
  it('prihvata ispravan manifest', () => {
    expect(fieldDefinitionsSchema.safeParse(definitions).success).toBe(true);
  });

  it('odbija ponovljen ključ polja', () => {
    const result = fieldDefinitionsSchema.safeParse({
      ...definitions,
      fields: [...definitions.fields, definitions.fields[0]],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('imeMlade');
    }
  });

  it('odbija polje u nepostojećoj grupi', () => {
    const result = fieldDefinitionsSchema.safeParse({
      ...definitions,
      fields: [{ ...definitions.fields[0]!, group: 'izmisljena' }],
    });

    expect(result.success).toBe(false);
  });

  it('odbija ključ koji ne bi bio bezbedan u atributu', () => {
    const result = fieldDefinitionsSchema.safeParse({
      ...definitions,
      fields: [{ ...definitions.fields[0]!, key: 'ime"onload=alert(1)' }],
    });

    expect(result.success).toBe(false);
  });

  it('traži bar jedno mesto prikaza', () => {
    const result = fieldDefinitionsSchema.safeParse({
      ...definitions,
      fields: [{ ...definitions.fields[0]!, bind: [] }],
    });

    expect(result.success).toBe(false);
  });

  it('traži srpski (latinica) u labeli', () => {
    const result = fieldDefinitionsSchema.safeParse({
      ...definitions,
      groups: [{ key: 'osnovno', label: { en: 'Basics' } }],
    });

    expect(result.success).toBe(false);
  });
});

describe('prevod labele', () => {
  it('vraća traženi jezik kada postoji', () => {
    expect(localized({ 'sr-Latn': 'Ime', en: 'Name' }, 'en')).toBe('Name');
  });

  it('pada na srpski (latinica) kada prevoda nema', () => {
    // Prazan prevod ne sme da ostavi prazan natpis u formi.
    expect(localized({ 'sr-Latn': 'Ime' }, 'de')).toBe('Ime');
  });
});

describe('vrednosti polja', () => {
  it('podrazumevane vrednosti dolaze iz manifesta', () => {
    expect(defaultFieldValues(definitions)).toEqual({
      imeMlade: 'Ana',
      datum: '2026-09-12',
      nasaPrica: '',
      link: '',
    });
  });

  it('obavezno polje ne sme da ostane prazno', () => {
    const { errors } = validateFieldValues(definitions, {
      imeMlade: '   ',
      datum: '2026-09-12',
    });

    expect(errors.imeMlade).toBeDefined();
    expect(errors.datum).toBeUndefined();
  });

  it('datum i vreme moraju da imaju očekivan oblik', () => {
    const { errors } = validateFieldValues(definitions, {
      imeMlade: 'Ana',
      datum: '12.09.2026.',
    });

    expect(errors.datum?.[0]).toContain('GGGG-MM-DD');
  });

  it('link mora da bude http(s)', () => {
    const { errors } = validateFieldValues(definitions, {
      imeMlade: 'Ana',
      datum: '2026-09-12',
      link: 'javascript:alert(1)',
    });

    expect(errors.link).toBeDefined();
  });

  it('poštuje najveću dužinu', () => {
    const { errors } = validateFieldValues(definitions, {
      imeMlade: 'Ana',
      datum: '2026-09-12',
      nasaPrica: 'x'.repeat(21),
    });

    expect(errors.nasaPrica?.[0]).toContain('20');
  });

  it('nepoznat ključ se odbacuje bez greške', () => {
    // Posle promene šablona ostaju ključevi kojih više nema; to nije greška
    // korisnika, pa se ne prijavljuje - samo se ne prenosi dalje.
    const { values, errors } = validateFieldValues(definitions, {
      imeMlade: 'Ana',
      datum: '2026-09-12',
      staroPolje: 'nešto',
    });

    expect(errors).toEqual({});
    expect(values).not.toHaveProperty('staroPolje');
  });

  it('vrednosti se čiste od suvišnih razmaka', () => {
    const { values } = validateFieldValues(definitions, {
      imeMlade: '  Ana  ',
      datum: '2026-09-12',
    });

    expect(values.imeMlade).toBe('Ana');
  });
});

describe('grupisanje za formu', () => {
  it('zadržava redosled grupa iz manifesta', () => {
    const groups = groupedFields(definitions);

    expect(groups.map((entry) => entry.group.key)).toEqual(['osnovno', 'prica']);
    expect(groups[0]?.fields.map((field) => field.key)).toEqual(['imeMlade', 'datum']);
  });

  it('prazna grupa se ne prikazuje', () => {
    const groups = groupedFields({
      groups: [...definitions.groups, { key: 'prazna', label: { 'sr-Latn': 'Prazna' } }],
      fields: definitions.fields,
    });

    expect(groups.map((entry) => entry.group.key)).not.toContain('prazna');
  });
});
