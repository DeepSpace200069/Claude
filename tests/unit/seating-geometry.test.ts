import { describe, expect, it } from 'vitest';

import {
  clampCapacity,
  clampTableSize,
  clampToRoom,
  nextFreeSeat,
  nextTableName,
  normalizeRotation,
} from '@/features/seating/geometry';

/**
 * Pravila rasporeda koja ne treba baza da bi se proverila.
 *
 * Ista pravila važe i dok organizator vuče sto po platnu i kada se položaj
 * upisuje, pa su i testirana na jednom mestu - da se dve primene ne raziđu.
 */
describe('rotacija', () => {
  it('svodi ugao na 0–359', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
  });

  it('negativan ugao postaje pozitivan', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-450)).toBe(270);
  });

  it('zaokružuje decimalni ugao', () => {
    expect(normalizeRotation(44.6)).toBe(45);
  });
});

describe('granice stola', () => {
  it('veličina ostaje u dozvoljenom rasponu', () => {
    expect(clampTableSize(10)).toBe(40);
    expect(clampTableSize(140)).toBe(140);
    expect(clampTableSize(5000)).toBe(800);
  });

  it('kapacitet ostaje u dozvoljenom rasponu', () => {
    expect(clampCapacity(0)).toBe(1);
    expect(clampCapacity(8)).toBe(8);
    expect(clampCapacity(999)).toBe(40);
  });
});

describe('sto ostaje u sali', () => {
  const table = { width: 140, height: 140 };
  const room = { width: 1200, height: 800 };

  it('položaj unutar sale se ne menja', () => {
    expect(clampToRoom({ x: 300, y: 200 }, table, room)).toEqual({ x: 300, y: 200 });
  });

  it('negativan položaj se vraća na ivicu', () => {
    expect(clampToRoom({ x: -50, y: -10 }, table, room)).toEqual({ x: 0, y: 0 });
  });

  it('sto ne izlazi kroz desnu i donju ivicu', () => {
    // Poslednji dozvoljeni položaj je širina sale minus širina stola.
    expect(clampToRoom({ x: 5000, y: 5000 }, table, room)).toEqual({
      x: 1060,
      y: 660,
    });
  });

  it('sto širi od sale ostaje na nuli, a ne u negativnom', () => {
    const huge = { width: 2000, height: 2000 };
    expect(clampToRoom({ x: 100, y: 100 }, huge, room)).toEqual({ x: 0, y: 0 });
  });

  it('zaokružuje na cele jedinice', () => {
    expect(clampToRoom({ x: 10.4, y: 20.6 }, table, room)).toEqual({ x: 10, y: 21 });
  });
});

describe('redni broj mesta', () => {
  it('prvo mesto je jedan', () => {
    expect(nextFreeSeat([])).toBe(1);
  });

  it('popunjava rupu pre nego što raste', () => {
    expect(nextFreeSeat([1, 3, 4])).toBe(2);
  });

  it('nastavlja iza poslednjeg kada rupa nema', () => {
    expect(nextFreeSeat([1, 2, 3])).toBe(4);
  });

  it('mesta bez broja se ne broje', () => {
    expect(nextFreeSeat([null, null])).toBe(1);
  });
});

describe('naziv stola', () => {
  it('slobodan naziv se koristi takav kakav je', () => {
    expect(nextTableName(new Set(), 'Sto 1')).toBe('Sto 1');
  });

  it('zauzet naziv dobija sufiks', () => {
    expect(nextTableName(new Set(['Sto 1']), 'Sto 1')).toBe('Sto 1 (2)');
  });

  it('sufiks se povećava dok se ne nađe slobodan', () => {
    const taken = new Set(['Sto 1', 'Sto 1 (2)', 'Sto 1 (3)']);
    expect(nextTableName(taken, 'Sto 1')).toBe('Sto 1 (4)');
  });

  it('vraća `null` kada slobodnog naziva nema', () => {
    const taken = new Set(['Sto']);
    for (let i = 2; i < 200; i += 1) taken.add(`Sto (${i})`);

    expect(nextTableName(taken, 'Sto')).toBeNull();
  });
});
