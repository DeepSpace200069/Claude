import { describe, expect, it } from 'vitest';

import { buildDemoContext } from '@/features/invitations/demo-context';
import { listSectionDefinitions } from '@/features/sections/registry';
import { RENDERABLE_SECTION_TYPES } from '@/features/sections/renderers';
import { themeDataAttributes, themeToCssVars } from '@/features/themes/css';
import { defaultThemeTokens } from '@/features/themes/tokens';
import { colorGroupOf } from '@/server/services/templates';
import { seedTemplates } from '@/server/db/seed-data/templates';
import { seedThemes } from '@/server/db/seed-data/themes';
import srLatn from '@/i18n/messages/sr-Latn';
import type { MessageTree } from '@/i18n/translator';

describe('registar renderera', () => {
  it('svaka registrovana sekcija ima renderer', () => {
    const missing = listSectionDefinitions()
      .map((definition) => definition.type)
      .filter((type) => !RENDERABLE_SECTION_TYPES.includes(type));

    expect(missing, `Sekcije bez renderera: ${missing.join(', ')}`).toEqual([]);
  });

  it('nema renderera bez odgovarajuće definicije', () => {
    const known = new Set(listSectionDefinitions().map((definition) => definition.type));
    const orphans = RENDERABLE_SECTION_TYPES.filter((type) => !known.has(type));

    expect(orphans, `Rendereri bez definicije: ${orphans.join(', ')}`).toEqual([]);
  });

  it('svaka sekcija ima prevedenu labelu i opis', () => {
    const catalog = srLatn as unknown as MessageTree;

    const lookup = (key: string): unknown =>
      key.split('.').reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object'
            ? (node as Record<string, unknown>)[part]
            : undefined,
        catalog,
      );

    for (const definition of listSectionDefinitions()) {
      expect(
        lookup(definition.labelKey),
        `Nedostaje prevod za "${definition.labelKey}".`,
      ).toBeTypeOf('string');
      expect(
        lookup(definition.descriptionKey),
        `Nedostaje prevod za "${definition.descriptionKey}".`,
      ).toBeTypeOf('string');
    }
  });
});

describe('tokeni teme u CSS', () => {
  it('proizvodi sve promenljive koje stil pozivnice koristi', () => {
    const vars = themeToCssVars(defaultThemeTokens) as Record<string, string>;

    for (const key of [
      '--inv-bg',
      '--inv-text',
      '--inv-accent',
      '--inv-font-display',
      '--inv-radius',
      '--inv-shadow',
      '--inv-motion-duration',
      '--inv-section-space',
    ]) {
      expect(vars[key], `Nedostaje promenljiva ${key}.`).toBeTruthy();
    }
  });

  it('tema bez animacija daje nulto trajanje', () => {
    const vars = themeToCssVars({
      ...defaultThemeTokens,
      motion: 'none',
    }) as Record<string, string>;

    expect(vars['--inv-motion-duration']).toBe('0ms');
    expect(vars['--inv-motion-distance']).toBe('0px');
  });

  it('data atributi prate izbore teme', () => {
    const attributes = themeDataAttributes({
      ...defaultThemeTokens,
      buttonStyle: 'outline',
      cardStyle: 'paper',
      motion: 'expressive',
    });

    expect(attributes['data-button']).toBe('outline');
    expect(attributes['data-card']).toBe('paper');
    expect(attributes['data-motion']).toBe('expressive');
  });

  it('svaki font par iz seed tema ima definisan stek', () => {
    for (const theme of seedThemes) {
      const vars = themeToCssVars(theme.tokens) as Record<string, string>;
      expect(
        vars['--inv-font-display'],
        `Tema "${theme.key}" nema naslovni font.`,
      ).toBeTruthy();
      expect(vars['--inv-font-display']).not.toContain('undefined');
    }
  });
});

describe('grupisanje dominantne boje', () => {
  it('prepoznaje tamne boje', () => {
    expect(colorGroupOf('#151217')).toBe('tamna');
    expect(colorGroupOf('#0f1117')).toBe('tamna');
  });

  it('prepoznaje tople i hladne svetle boje', () => {
    expect(colorGroupOf('#fdf7ef')).toBe('topla');
    expect(colorGroupOf('#f4f8fb')).toBe('hladna');
  });

  it('neutralnu svetlu boju svrstava u „svetla"', () => {
    expect(colorGroupOf('#f8f8f8')).toBe('svetla');
  });

  it('neispravan zapis ne ruši grupisanje', () => {
    expect(colorGroupOf('nije-boja')).toBe('svetla');
    expect(colorGroupOf('')).toBe('svetla');
  });

  it('svaki seed šablon dobija jednu od poznatih grupa', () => {
    for (const template of seedTemplates) {
      expect(['svetla', 'topla', 'hladna', 'tamna']).toContain(
        colorGroupOf(template.dominantColor),
      );
    }
  });
});

describe('demo kontekst', () => {
  const reference = new Date('2026-01-15T10:00:00Z');

  it('daje datum u budućnosti', () => {
    const context = buildDemoContext('wedding', null, reference);
    expect(new Date(context.startsAt!).getTime()).toBeGreaterThan(reference.getTime());
  });

  it('uvek je u preview režimu', () => {
    // Demo ne sme da se predstavi kao živa pozivnica: RSVP forma tada prikazuje
    // napomenu i onemogućena je.
    expect(buildDemoContext('wedding', null, reference).mode).toBe('preview');
  });

  it('koristi podatke primerene tipu proslave', () => {
    expect(buildDemoContext('christening', null, reference).details).toHaveProperty(
      'childName',
    );
    expect(buildDemoContext('wedding', null, reference).details).toHaveProperty(
      'partner1Name',
    );
  });

  it('nepoznat tip pada na rezervne podatke umesto da pukne', () => {
    const context = buildDemoContext('ne-postoji-ovaj-tip', null, reference);
    expect(context.city).toBeTruthy();
    expect(context.startsAt).toBeTruthy();
  });

  it('poštuje vrednosti koje administrator zada na verziji šablona', () => {
    const context = buildDemoContext(
      'wedding',
      { city: 'Niš', venueName: 'Vila Kalemegdan' },
      reference,
    );

    expect(context.city).toBe('Niš');
    expect(context.venueName).toBe('Vila Kalemegdan');
    // Ono što nije zadato ostaje na podrazumevanoj vrednosti.
    expect(context.details).toHaveProperty('partner1Name');
  });

  it('demo nema fotografije, pa sekcije sa slikama moraju to da podnesu', () => {
    expect(buildDemoContext('wedding', null, reference).media).toEqual({});
  });
});

describe('seed šabloni', () => {
  it('pokrivaju sve četiri glavne kategorije sa bar dva šablona', () => {
    const byType = new Map<string, number>();
    for (const template of seedTemplates) {
      byType.set(template.eventTypeKey, (byType.get(template.eventTypeKey) ?? 0) + 1);
    }

    for (const key of ['wedding', 'christening', 'first_birthday', 'coming_of_age']) {
      expect(byType.get(key) ?? 0, `Kategorija "${key}" ima manje od dva šablona.`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('slugovi su jedinstveni i ASCII', () => {
    const slugs = seedTemplates.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('svaki šablon referiše postojeću temu', () => {
    const themeKeys = new Set(seedThemes.map((theme) => theme.key));
    for (const template of seedTemplates) {
      expect(themeKeys.has(template.themeKey), `Tema "${template.themeKey}" ne postoji.`).toBe(
        true,
      );
    }
  });

  it('svaki šablon ima naslovnu sekciju i sekcije poređane od nule', () => {
    for (const template of seedTemplates) {
      const types = template.sections.map((section) => section.type);
      expect(types, `Šablon "${template.slug}" nema naslovnu sekciju.`).toContain('hero');

      const positions = template.sections.map((section) => section.position);
      expect(positions, `Šablon "${template.slug}" ima pogrešne pozicije.`).toEqual(
        positions.map((_, index) => index),
      );
    }
  });

  it('svaki šablon koristi samo registrovane tipove sekcija', () => {
    const known = new Set(listSectionDefinitions().map((definition) => definition.type));

    for (const template of seedTemplates) {
      for (const section of template.sections) {
        expect(
          known.has(section.type),
          `Šablon "${template.slug}" koristi nepoznat tip "${section.type}".`,
        ).toBe(true);
      }
    }
  });
});
