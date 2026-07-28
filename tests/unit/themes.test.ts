import { describe, expect, it } from 'vitest';

import {
  auditThemeContrast,
  contrastRatio,
  meetsContrast,
  parseColor,
} from '@/features/themes/contrast';
import { defaultThemeTokens, themeTokensSchema } from '@/features/themes/tokens';
import { seedThemes } from '@/server/db/seed-data/themes';

describe('parsiranje boja', () => {
  it('čita hex zapis', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('čita oklch zapis', () => {
    const white = parseColor('oklch(1 0 0)');
    expect(white).not.toBeNull();
    expect(white!.r).toBeGreaterThan(250);
  });

  it('vraća null za neispravan zapis', () => {
    expect(parseColor('crvena')).toBeNull();
  });
});

describe('odnos kontrasta', () => {
  it('crna na beloj daje 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('ista boja daje 1:1', () => {
    expect(contrastRatio('#7d3f57', '#7d3f57')).toBeCloseTo(1, 5);
  });

  it('redosled argumenata ne menja rezultat', () => {
    expect(contrastRatio('#333333', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#333333'),
      5,
    );
  });

  it('meetsContrast primenjuje AA prag', () => {
    expect(meetsContrast('#767676', '#ffffff')).toBe(true);
    expect(meetsContrast('#999999', '#ffffff')).toBe(false);
    // Za veliki tekst prag je blaži.
    expect(meetsContrast('#949494', '#ffffff', { large: true })).toBe(true);
  });
});

describe('teme iz seed podataka', () => {
  it('svaka tema prolazi šemu tokena', () => {
    for (const theme of seedThemes) {
      const result = themeTokensSchema.safeParse(theme.tokens);
      expect(result.success, `Tema "${theme.key}" ne prolazi šemu tokena.`).toBe(true);
    }
  });

  it('nijedna tema nema problem sa kontrastom', () => {
    for (const theme of seedThemes) {
      const issues = auditThemeContrast(theme.tokens.palette);
      expect(
        issues,
        `Tema "${theme.key}" ima nedovoljan kontrast: ${JSON.stringify(issues)}`,
      ).toEqual([]);
    }
  });

  it('ključevi tema su jedinstveni', () => {
    const keys = seedThemes.map((theme) => theme.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('podrazumevana tema je čitljiva', () => {
    expect(auditThemeContrast(defaultThemeTokens.palette)).toEqual([]);
  });
});

describe('audit kontrasta', () => {
  it('prijavljuje nečitljivu kombinaciju', () => {
    const issues = auditThemeContrast({
      background: '#ffffff',
      surface: '#ffffff',
      text: '#eeeeee',
      textMuted: '#f0f0f0',
      accent: '#ffffff',
      accentContrast: '#fefefe',
    });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => issue.pair)).toContain('text/background');
  });
});
