import { describe, expect, it } from 'vitest';

import { validateAnswers } from '@/features/rsvp/schemas';
import { formatAnswer } from '@/features/rsvp/export';
import type { RsvpQuestion, RsvpQuestionType } from '@/features/rsvp/types';

/**
 * Odgovori na dodatna pitanja stižu od gosta bez naloga, pa se mere isključivo
 * prema pitanju koje je organizator zaista postavio - nikad prema onome što je
 * klijent poslao uz odgovor.
 */
function question(overrides: Partial<RsvpQuestion> & { type: RsvpQuestionType }): RsvpQuestion {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    label: 'Pitanje',
    helpText: null,
    isRequired: false,
    attendingOnly: false,
    position: 0,
    config: {},
    ...overrides,
  };
}

const MENU = question({
  type: 'single_choice',
  config: {
    options: [
      { value: 'o1', label: 'Meso' },
      { value: 'o2', label: 'Riba' },
    ],
  },
});

describe('jedan izbor', () => {
  it('prihvata ponuđenu opciju', () => {
    const result = validateAnswers([MENU], { [MENU.id]: 'o2' }, 'yes');
    expect(result.errors).toEqual({});
    expect(result.values[MENU.id]).toBe('o2');
  });

  it('odbija opciju koja nije ponuđena', () => {
    const result = validateAnswers([MENU], { [MENU.id]: 'o9' }, 'yes');
    expect(result.errors[`answers.${MENU.id}`]).toBeDefined();
  });

  it('prazan odgovor na neobavezno pitanje nije greška', () => {
    const result = validateAnswers([MENU], { [MENU.id]: '' }, 'yes');
    expect(result.errors).toEqual({});
    expect(result.values[MENU.id]).toBeUndefined();
  });

  it('prazan odgovor na obavezno pitanje jeste greška', () => {
    const required = { ...MENU, isRequired: true };
    const result = validateAnswers([required], {}, 'yes');
    expect(result.errors[`answers.${MENU.id}`]).toEqual(['Ovo polje je obavezno.']);
  });
});

describe('više izbora', () => {
  const multi = question({
    type: 'multi_choice',
    id: '22222222-2222-4333-8444-555555555555',
    config: {
      options: [
        { value: 'o1', label: 'Prevoz' },
        { value: 'o2', label: 'Smeštaj' },
      ],
    },
  });

  it('prihvata više vrednosti', () => {
    const result = validateAnswers([multi], { [multi.id]: ['o1', 'o2'] }, 'yes');
    expect(result.values[multi.id]).toEqual(['o1', 'o2']);
  });

  it('odbija vrednost van ponuđenih', () => {
    const result = validateAnswers([multi], { [multi.id]: ['o1', 'o7'] }, 'yes');
    expect(result.errors[`answers.${multi.id}`]).toBeDefined();
  });

  it('prazan niz znači „nije odgovoreno"', () => {
    const result = validateAnswers([multi], { [multi.id]: [] }, 'yes');
    expect(result.errors).toEqual({});
    expect(result.values[multi.id]).toBeUndefined();
  });
});

describe('ostali tipovi', () => {
  it('da/ne prima i tekstualni oblik iz forme', () => {
    const yesNo = question({ type: 'boolean', id: '33333333-2222-4333-8444-555555555555' });

    expect(validateAnswers([yesNo], { [yesNo.id]: 'true' }, 'yes').values[yesNo.id]).toBe(
      true,
    );
    expect(validateAnswers([yesNo], { [yesNo.id]: false }, 'yes').values[yesNo.id]).toBe(
      false,
    );
  });

  it('broj poštuje granice iz pitanja', () => {
    const count = question({
      type: 'number',
      id: '44444444-2222-4333-8444-555555555555',
      config: { min: 1, max: 5 },
    });

    expect(validateAnswers([count], { [count.id]: '3' }, 'yes').values[count.id]).toBe(3);
    expect(
      validateAnswers([count], { [count.id]: '9' }, 'yes').errors[`answers.${count.id}`],
    ).toBeDefined();
  });

  it('tekst poštuje najveću dužinu', () => {
    const text = question({
      type: 'text',
      id: '55555555-2222-4333-8444-555555555555',
      config: { maxLength: 10 },
    });

    expect(
      validateAnswers([text], { [text.id]: 'x'.repeat(20) }, 'yes').errors[
        `answers.${text.id}`
      ],
    ).toBeDefined();
  });

  it('datum mora biti u obliku GGGG-MM-DD', () => {
    const date = question({ type: 'date', id: '66666666-2222-4333-8444-555555555555' });

    expect(validateAnswers([date], { [date.id]: '2026-08-15' }, 'yes').values[date.id]).toBe(
      '2026-08-15',
    );
    expect(
      validateAnswers([date], { [date.id]: '15.08.2026.' }, 'yes').errors[
        `answers.${date.id}`
      ],
    ).toBeDefined();
  });
});

describe('pitanja vezana za dolazak', () => {
  const menuRequired = { ...MENU, attendingOnly: true, isRequired: true };

  it('gost koji ne dolazi ih ne dobija i ne pada na njima', () => {
    const result = validateAnswers([menuRequired], {}, 'no');
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({});
  });

  it('odgovor poslat uz „ne dolazim" se ne čuva', () => {
    // Klijent sme da pošalje šta hoće; merodavno je pitanje, ne poruka.
    const result = validateAnswers([menuRequired], { [MENU.id]: 'o1' }, 'no');
    expect(result.values).toEqual({});
  });

  it('gost koji dolazi mora da odgovori', () => {
    const result = validateAnswers([menuRequired], {}, 'yes');
    expect(result.errors[`answers.${MENU.id}`]).toBeDefined();
  });
});

describe('prikaz odgovora', () => {
  it('ključ opcije se prevodi u tekst koji je gost video', () => {
    expect(formatAnswer(MENU, 'o1', 'Da', 'Ne')).toBe('Meso');
  });

  it('nepoznat ključ ne ruši prikaz', () => {
    // Opcija je u međuvremenu obrisana; bolje ključ nego prazna ćelija.
    expect(formatAnswer(MENU, 'o9', 'Da', 'Ne')).toBe('o9');
  });

  it('da/ne dobija reč, ne `true`', () => {
    const yesNo = question({ type: 'boolean' });
    expect(formatAnswer(yesNo, true, 'Da', 'Ne')).toBe('Da');
    expect(formatAnswer(yesNo, false, 'Da', 'Ne')).toBe('Ne');
  });
});
