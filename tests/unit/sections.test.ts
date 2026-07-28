import { describe, expect, it } from 'vitest';

import {
  prepareSectionsForRender,
  readSectionData,
  validateSectionData,
} from '@/features/sections/migrate';
import {
  getSectionDefinition,
  listSectionDefinitions,
  listSectionsForEventType,
  requireSectionDefinition,
  SECTION_TYPES,
} from '@/features/sections/registry';
import { defineSection } from '@/features/sections/types';
import { z } from 'zod';

describe('registar sekcija', () => {
  it('svaka definicija ima jedinstven tip', () => {
    const types = listSectionDefinitions().map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('podrazumevani podaci svake sekcije prolaze sopstvenu šemu', () => {
    for (const definition of listSectionDefinitions()) {
      const result = definition.schema.safeParse(definition.getDefaultData());
      expect(
        result.success,
        `Sekcija "${definition.type}" ima podrazumevane podatke koji ne prolaze validaciju.`,
      ).toBe(true);
    }
  });

  it('sve sekcije imaju ključeve prevoda, a ne fiksan tekst', () => {
    for (const definition of listSectionDefinitions()) {
      expect(definition.labelKey).toMatch(/^sections\.[a-zA-Z]+\.label$/);
      expect(definition.descriptionKey).toMatch(/^sections\.[a-zA-Z]+\.description$/);
    }
  });

  it('registruje očekivane osnovne sekcije', () => {
    for (const type of ['hero', 'locations', 'schedule', 'gallery', 'rsvp', 'footer']) {
      expect(SECTION_TYPES).toContain(type);
    }
  });

  it('requireSectionDefinition baca grešku za nepoznat tip', () => {
    expect(() => requireSectionDefinition('nepostojeca')).toThrow(/Nepoznat tip sekcije/);
    expect(getSectionDefinition('nepostojeca')).toBeUndefined();
  });

  it('filtrira sekcije po tipu događaja', () => {
    const forWedding = listSectionsForEventType('wedding');
    // Sve trenutne sekcije su dozvoljene svuda (allowedEventTypes === null).
    expect(forWedding.length).toBe(listSectionDefinitions().length);
  });
});

describe('validacija podataka sekcije', () => {
  it('prihvata ispravne podatke', () => {
    const result = validateSectionData('hero', {
      eyebrow: 'Pozivamo vas',
      title: 'Ana i Marko',
      subtitle: '',
      image: null,
      layout: 'centered',
      overlayOpacity: 25,
      showIntroAnimation: true,
    });
    expect(result.ok).toBe(true);
  });

  it('vraća greške po poljima za neispravne podatke', () => {
    const result = validateSectionData('hero', { layout: 'nepostojeci-raspored' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors)).toContain('layout');
    }
  });

  it('odbija linkove sa nedozvoljenim protokolom', () => {
    const result = validateSectionData('custom_content', {
      title: 'Test',
      content: { blocks: [] },
      image: null,
      button: { label: 'Klik', url: 'javascript:alert(1)', style: 'primary' },
    });
    expect(result.ok).toBe(false);
  });

  it('prihvata https linkove', () => {
    const result = validateSectionData('custom_content', {
      title: 'Test',
      content: { blocks: [] },
      image: null,
      button: { label: 'Klik', url: 'https://primer.rs/stranica', style: 'primary' },
    });
    expect(result.ok).toBe(true);
  });

  it('odbija vreme u pogrešnom formatu', () => {
    const result = validateSectionData('schedule', {
      title: 'Satnica',
      intro: '',
      style: 'timeline',
      items: [
        { id: 'a', time: '25:00', title: 'Polazak', description: '', locationRef: '', locationLabel: '', icon: 'clock', image: null },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe('migracija verzija šeme', () => {
  /** Sekcija sa dve verzije - simulira stvarnu promenu oblika podataka. */
  const v2Schema = z.object({ title: z.string(), subtitle: z.string() });

  const legacySection = defineSection({
    type: 'test_legacy',
    version: 2,
    labelKey: 'sections.test.label',
    descriptionKey: 'sections.test.description',
    icon: 'star',
    category: 'basics',
    schema: v2Schema,
    allowedEventTypes: null,
    getDefaultData: () => ({ title: '', subtitle: '' }),
    migrate: (data, fromVersion) => {
      if (fromVersion === 1) {
        const old = data as { heading?: string };
        return { title: old.heading ?? '', subtitle: '' };
      }
      return v2Schema.parse(data);
    },
  });

  it('migrira podatke sa starije verzije', () => {
    const migrated = legacySection.migrate?.({ heading: 'Stari naslov' }, 1);
    expect(migrated).toEqual({ title: 'Stari naslov', subtitle: '' });
  });

  it('čitanje podataka aktuelne verzije ne pokreće migraciju', () => {
    const result = readSectionData('hero', getSectionDefinition('hero')!.getDefaultData(), 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.migrated).toBe(false);
  });

  it('vraća grešku kada su podaci noviji od koda', () => {
    const result = readSectionData('hero', {}, 99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/verzijom šeme 99/);
  });

  it('nepoznat tip sekcije ne baca izuzetak', () => {
    const result = readSectionData('ne-postoji', {}, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Nepoznat tip sekcije/);
  });

  it('vraća podrazumevane podatke kada je sadržaj neispravan', () => {
    const result = readSectionData('hero', { layout: 'nepostojeci' }, 1);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(getSectionDefinition('hero')!.getDefaultData());
  });
});

describe('priprema sekcija za prikaz', () => {
  const hero = getSectionDefinition('hero')!;

  it('sortira po poziciji i izostavlja sakrivene sekcije', () => {
    const prepared = prepareSectionsForRender([
      { id: '2', type: 'hero', schemaVersion: 1, position: 2, isVisible: true, data: hero.getDefaultData() },
      { id: '1', type: 'hero', schemaVersion: 1, position: 0, isVisible: true, data: hero.getDefaultData() },
      { id: '3', type: 'hero', schemaVersion: 1, position: 1, isVisible: false, data: hero.getDefaultData() },
    ]);

    expect(prepared.map((s) => s.id)).toEqual(['1', '2']);
  });

  it('preskače oštećenu sekciju umesto da obori ceo prikaz', () => {
    const errors: string[] = [];
    const prepared = prepareSectionsForRender(
      [
        { id: 'ok', type: 'hero', schemaVersion: 1, position: 0, isVisible: true, data: hero.getDefaultData() },
        { id: 'bad', type: 'hero', schemaVersion: 1, position: 1, isVisible: true, data: { layout: 'x' } },
      ],
      (id) => errors.push(id),
    );

    expect(prepared.map((s) => s.id)).toEqual(['ok']);
    expect(errors).toEqual(['bad']);
  });
});
