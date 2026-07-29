import { describe, expect, it } from 'vitest';

import {
  addSection,
  applyTemplateToDocument,
  deepEqual,
  documentFromRecords,
  documentsEqual,
  duplicateSection,
  findSection,
  isDefaultData,
  moveSection,
  moveSectionBy,
  normalizePositions,
  removeSection,
  resetSection,
  setSectionVisibility,
  updateSectionData,
  validateDocument,
  type EditorDocument,
} from '@/features/editor/document';
import { requireSectionDefinition } from '@/features/sections/registry';
import { defaultThemeTokens } from '@/features/themes/tokens';

/**
 * Model dokumenta je jedini izvor istine uređivača, pa se testira odvojeno od
 * interfejsa: sve operacije su čiste funkcije i mogu da se provere bez DOM-a.
 */
function emptyDocument(): EditorDocument {
  return { theme: defaultThemeTokens, sections: [] };
}

function withSections(...types: string[]): EditorDocument {
  return types.reduce<EditorDocument>((document, type) => {
    const result = addSection(document, type);
    if (!result.ok) throw new Error(`Sekcija "${type}" nije dodata: ${result.reason}`);
    return result.document;
  }, emptyDocument());
}

describe('deepEqual', () => {
  it('poredi ugnežđene objekte i nizove po vrednosti', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('razlikuje niz od objekta i vodi računa o broju ključeva', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it('null nije jednak objektu', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });
});

describe('dodavanje sekcija', () => {
  it('dodaje sekciju sa podrazumevanim sadržajem i ispravnom verzijom šeme', () => {
    const result = addSection(emptyDocument(), 'message');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const section = result.document.sections[0];
    expect(section?.type).toBe('message');
    expect(section?.schemaVersion).toBe(requireSectionDefinition('message').version);
    expect(section?.isVisible).toBe(true);
    expect(isDefaultData('message', section?.data)).toBe(true);
  });

  it('odbija nepoznat tip umesto da baci izuzetak', () => {
    const result = addSection(emptyDocument(), 'ne-postoji');
    expect(result).toEqual({ ok: false, reason: 'unknown_type' });
  });

  it('odbija drugu naslovnu sekciju jer je označena kao jedinstvena', () => {
    const document = withSections('hero');
    expect(addSection(document, 'hero')).toEqual({
      ok: false,
      reason: 'singleton_exists',
    });
  });

  it('umeće sekciju na traženo mesto i preračunava pozicije', () => {
    const document = withSections('hero', 'message', 'footer');
    const result = addSection(document, 'countdown', 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.sections.map((section) => section.type)).toEqual([
      'hero',
      'countdown',
      'message',
      'footer',
    ]);
    expect(result.document.sections.map((section) => section.position)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('indeks van opsega se svodi na kraj liste', () => {
    const document = withSections('hero');
    const result = addSection(document, 'message', 99);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.sections[1]?.type).toBe('message');
  });
});

describe('operacije nad sekcijama', () => {
  it('brisanje uklanja sekciju i sređuje pozicije', () => {
    const document = withSections('hero', 'message', 'footer');
    const target = document.sections[1];
    const next = removeSection(document, target?.id ?? '');

    expect(next.sections.map((section) => section.type)).toEqual(['hero', 'footer']);
    expect(next.sections.map((section) => section.position)).toEqual([0, 1]);
  });

  it('brisanje nepostojeće sekcije vraća isti dokument', () => {
    const document = withSections('hero');
    expect(removeSection(document, 'nema-me')).toBe(document);
  });

  it('dupliranje pravi kopiju sa novim identifikatorom odmah ispod originala', () => {
    const document = updateSectionData(
      withSections('hero', 'message'),
      withSections('hero', 'message').sections[1]?.id ?? '',
      { title: 'Kopiraj me', body: '', signature: '', alignment: 'center', decoration: 'none' },
    );

    const source = document.sections[1];
    const result = duplicateSection(document, source?.id ?? '');

    expect(result.sectionId).not.toBeNull();
    expect(result.document.sections).toHaveLength(3);
    expect(result.document.sections[2]?.type).toBe('message');
    expect(result.document.sections[2]?.id).not.toBe(source?.id);
    expect(result.document.sections[2]?.data).toEqual(source?.data);
  });

  it('jedinstvena sekcija se ne duplira', () => {
    const document = withSections('hero');
    const result = duplicateSection(document, document.sections[0]?.id ?? '');

    expect(result.sectionId).toBeNull();
    expect(result.document).toBe(document);
  });

  it('kopija ne deli objekat sa originalom', () => {
    const document = withSections('locations');
    const original = document.sections[0];
    const result = duplicateSection(document, original?.id ?? '');
    const copy = result.document.sections[1];

    expect(copy?.data).not.toBe(original?.data);
    expect(copy?.data).toEqual(original?.data);
  });

  it('pomeranje menja redosled i pozicije', () => {
    const document = withSections('hero', 'message', 'footer');
    const moved = moveSection(document, document.sections[2]?.id ?? '', 0);

    expect(moved.sections.map((section) => section.type)).toEqual([
      'footer',
      'hero',
      'message',
    ]);
    expect(moved.sections.map((section) => section.position)).toEqual([0, 1, 2]);
  });

  it('pomeranje van granica ostaje unutar liste', () => {
    const document = withSections('hero', 'message');
    const first = document.sections[0]?.id ?? '';

    expect(moveSectionBy(document, first, -1)).toBe(document);
    expect(
      moveSectionBy(document, first, 5).sections.map((section) => section.type),
    ).toEqual(['message', 'hero']);
  });

  it('sakrivanje ne briše sadržaj sekcije', () => {
    const document = withSections('message');
    const id = document.sections[0]?.id ?? '';
    const edited = updateSectionData(document, id, {
      title: 'Ostajem',
      body: '',
      signature: '',
      alignment: 'center',
      decoration: 'none',
    });

    const hidden = setSectionVisibility(edited, id, false);

    expect(hidden.sections[0]?.isVisible).toBe(false);
    expect((hidden.sections[0]?.data as { title: string }).title).toBe('Ostajem');
  });

  it('resetovanje vraća podrazumevani sadržaj, a sekcija ostaje', () => {
    const document = withSections('message');
    const id = document.sections[0]?.id ?? '';
    const edited = updateSectionData(document, id, {
      title: 'Nešto',
      body: 'Tekst',
      signature: '',
      alignment: 'center',
      decoration: 'none',
    });

    const reset = resetSection(edited, id);

    expect(reset.sections).toHaveLength(1);
    expect(isDefaultData('message', reset.sections[0]?.data)).toBe(true);
  });

  it('normalizePositions ne pravi nove objekte kad je redosled već ispravan', () => {
    const document = withSections('hero', 'message');
    const normalized = normalizePositions(document.sections);

    expect(normalized[0]).toBe(document.sections[0]);
    expect(normalized[1]).toBe(document.sections[1]);
  });

  it('findSection nalazi sekciju po identifikatoru', () => {
    const document = withSections('hero', 'message');
    const id = document.sections[1]?.id ?? '';

    expect(findSection(document, id)?.type).toBe('message');
    expect(findSection(document, 'nema-me')).toBeNull();
  });
});

describe('validacija dokumenta', () => {
  it('prazan dokument nema problema', () => {
    expect(validateDocument(emptyDocument())).toEqual([]);
  });

  it('prijavljuje sekciju sa neispravnim podacima', () => {
    const document = withSections('message');
    const broken = updateSectionData(document, document.sections[0]?.id ?? '', {
      title: 123,
    });

    const issues = validateDocument(broken);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('message');
  });

  it('prijavljuje nepoznat tip sekcije', () => {
    const document: EditorDocument = {
      theme: defaultThemeTokens,
      sections: [
        {
          id: 'a',
          type: 'iz-buducnosti',
          schemaVersion: 1,
          position: 0,
          isVisible: true,
          data: {},
        },
      ],
    };

    expect(validateDocument(document)[0]?.message).toContain('iz-buducnosti');
  });
});

describe('učitavanje iz baze', () => {
  it('sortira po poziciji i migrira podatke kroz registar', () => {
    const document = documentFromRecords(defaultThemeTokens, [
      {
        id: 'b',
        type: 'message',
        schemaVersion: 1,
        position: 5,
        isVisible: true,
        data: { title: 'Druga' },
      },
      {
        id: 'a',
        type: 'hero',
        schemaVersion: 1,
        position: 1,
        isVisible: true,
        data: {},
      },
    ]);

    expect(document.sections.map((section) => section.id)).toEqual(['a', 'b']);
    expect(document.sections.map((section) => section.position)).toEqual([0, 1]);
  });

  it('nepoznat tip se preskače i prijavljuje, umesto da obori uređivač', () => {
    const issues: string[] = [];

    const document = documentFromRecords(
      defaultThemeTokens,
      [
        { id: 'a', type: 'hero', schemaVersion: 1, position: 0, isVisible: true, data: {} },
        {
          id: 'b',
          type: 'nepoznato',
          schemaVersion: 1,
          position: 1,
          isVisible: true,
          data: {},
        },
      ],
      (_, message) => issues.push(message),
    );

    expect(document.sections.map((section) => section.type)).toEqual(['hero']);
    expect(issues).toHaveLength(1);
  });

  it('oštećeni podaci poznatog tipa daju podrazumevani sadržaj, ne prazan ekran', () => {
    const issues: string[] = [];

    const document = documentFromRecords(
      defaultThemeTokens,
      [
        {
          id: 'a',
          type: 'message',
          schemaVersion: 1,
          position: 0,
          isVisible: true,
          data: { alignment: 'dijagonalno' },
        },
      ],
      (_, message) => issues.push(message),
    );

    expect(document.sections).toHaveLength(1);
    expect(isDefaultData('message', document.sections[0]?.data)).toBe(true);
    expect(issues).toHaveLength(1);
  });
});

describe('promena šablona (zahtev 3.12)', () => {
  const templateSections = [
    {
      type: 'hero',
      schemaVersion: 1,
      position: 0,
      isVisible: true,
      data: {
        eyebrow: 'Šablon kaže',
        title: 'Naslov iz šablona',
        subtitle: '',
        image: null,
        layout: 'split' as const,
        overlayOpacity: 25,
        showIntroAnimation: true,
      },
    },
    {
      type: 'locations',
      schemaVersion: 1,
      position: 1,
      isVisible: true,
      data: { title: '', intro: '', layout: 'cards' as const, locations: [] },
    },
  ];

  const otherTheme = {
    ...defaultThemeTokens,
    palette: { ...defaultThemeTokens.palette, accent: '#123456' },
  };

  it('zadržava tekst koji je korisnik uneo, a preuzima raspored i temu šablona', () => {
    const base = withSections('hero');
    const heroId = base.sections[0]?.id ?? '';
    const filled = updateSectionData(base, heroId, {
      eyebrow: 'Pozivamo vas',
      title: 'Ana i Marko',
      subtitle: '',
      image: null,
      layout: 'centered',
      overlayOpacity: 25,
      showIntroAnimation: true,
    });

    const result = applyTemplateToDocument(filled, {
      themeTokens: otherTheme,
      sections: templateSections,
    });

    expect(result.theme.palette.accent).toBe('#123456');
    expect(result.sections.map((section) => section.type)).toEqual([
      'hero',
      'locations',
    ]);
    // Korisnikov naslov preživljava; šablon donosi samo raspored.
    expect((result.sections[0]?.data as { title: string }).title).toBe('Ana i Marko');
    expect(result.sections[0]?.id).toBe(heroId);
  });

  it('prazna sekcija ustupa mesto sadržaju šablona', () => {
    const base = withSections('hero');

    const result = applyTemplateToDocument(base, {
      themeTokens: otherTheme,
      sections: templateSections,
    });

    expect((result.sections[0]?.data as { title: string }).title).toBe(
      'Naslov iz šablona',
    );
  });

  it('popunjene sekcije koje šablon nema ostaju na kraju', () => {
    const base = withSections('hero', 'guestbook');
    const guestbookId = base.sections[1]?.id ?? '';
    const filled = updateSectionData(base, guestbookId, {
      title: 'Ostavite poruku',
      intro: '',
      requireApproval: true,
      showPublicly: true,
      allowReactions: true,
      maxMessageLength: 500,
    });

    const result = applyTemplateToDocument(filled, {
      themeTokens: otherTheme,
      sections: templateSections,
    });

    expect(result.sections.map((section) => section.type)).toEqual([
      'hero',
      'locations',
      'guestbook',
    ]);
    expect(result.sections.map((section) => section.position)).toEqual([0, 1, 2]);
  });

  it('sekcija koju registar ne poznaje se ne prenosi iz šablona', () => {
    const result = applyTemplateToDocument(emptyDocument(), {
      themeTokens: otherTheme,
      sections: [
        ...templateSections,
        {
          type: 'nepoznato',
          schemaVersion: 1,
          position: 2,
          isVisible: true,
          data: {},
        },
      ],
    });

    expect(result.sections.map((section) => section.type)).toEqual([
      'hero',
      'locations',
    ]);
  });

  it('rezultat prolazi validaciju', () => {
    const result = applyTemplateToDocument(emptyDocument(), {
      themeTokens: otherTheme,
      sections: templateSections,
    });

    expect(validateDocument(result)).toEqual([]);
  });
});

describe('poređenje dokumenata', () => {
  it('isti sadržaj sa različitim referencama je jednak', () => {
    const a = withSections('hero');
    const b: EditorDocument = { theme: a.theme, sections: a.sections.map((s) => ({ ...s })) };
    expect(documentsEqual(a, b)).toBe(true);
  });

  it('izmena teme čini dokumente različitim', () => {
    const a = withSections('hero');
    const b: EditorDocument = {
      ...a,
      theme: { ...a.theme, motion: 'expressive' },
    };
    expect(documentsEqual(a, b)).toBe(false);
  });
});
