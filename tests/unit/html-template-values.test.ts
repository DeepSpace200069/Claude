import { describe, expect, it } from 'vitest';

import { renderTemplateDocument } from '@/features/invitations/html-document';
import type { FieldDefinitions } from '@/features/templates/html-schema';
import {
  isUploadedPhoto,
  renderInvitationHtml,
  resolveFieldValues,
} from '@/features/templates/html-values';

/**
 * Razrešavanje vrednosti polja (zahtev 39.4).
 *
 * Isti modul koriste živi pregled u uređivaču, javna pozivnica i demo prikaz.
 * Zbog toga pregled u pregledaču pokazuje **tačno** ono što gost dobija - a ne
 * približno. Testovi zato proveravaju ono na čemu se te tri strane mogu raziću:
 * šta je slika, šta se dopunjuje podrazumevanim, a šta ostaje prazno.
 */
const definitions: FieldDefinitions = {
  groups: [{ key: 'osnovno', label: { 'sr-Latn': 'Osnovno' } }],
  fields: [
    {
      key: 'imena',
      type: 'text',
      group: 'osnovno',
      label: { 'sr-Latn': 'Imena' },
      required: true,
      default: 'Ana i Marko',
      bind: [{ kind: 'text', selector: '#imena' }],
    },
    {
      key: 'poruka',
      type: 'longtext',
      group: 'osnovno',
      label: { 'sr-Latn': 'Poruka' },
      required: false,
      default: 'Radujemo se',
      bind: [{ kind: 'text', selector: '#poruka' }],
    },
    {
      key: 'slika',
      type: 'image',
      group: 'osnovno',
      label: { 'sr-Latn': 'Slika' },
      required: false,
      default: 'img/hero.webp',
      bind: [{ kind: 'attr', selector: '#slika', attr: 'src' }],
    },
  ],
};

const resolution = {
  assetUrl: (path: string) => `/sabloni-fajlovi/v1/${path}`,
  mediaUrl: (assetId: string) =>
    assetId === '11111111-2222-3333-4444-555555555555'
      ? 'https://cdn.test/foto.webp'
      : null,
};

describe('šta je otpremljena fotografija', () => {
  it('ključ fotografije je UUID, putanja šablona nije', () => {
    expect(isUploadedPhoto('11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isUploadedPhoto('img/hero.webp')).toBe(false);
  });
});

describe('razrešavanje vrednosti', () => {
  it('nedostajuće polje dobija podrazumevanu vrednost iz šablona', () => {
    const values = resolveFieldValues(definitions, {}, resolution);

    expect(values.imena).toBe('Ana i Marko');
    expect(values.poruka).toBe('Radujemo se');
  });

  it('obrisan tekst ostaje obrisan', () => {
    // Organizator koji obriše tekst očekuje da tog teksta nema, a ne da se
    // vrati šablonski.
    const values = resolveFieldValues(definitions, { poruka: '' }, resolution);

    expect(values.poruka).toBe('');
  });

  it('slika iz šablona postaje adresa fajla šablona', () => {
    const values = resolveFieldValues(definitions, {}, resolution);

    expect(values.slika).toBe('/sabloni-fajlovi/v1/img/hero.webp');
  });

  it('otpremljena fotografija postaje adresa fotografije', () => {
    const values = resolveFieldValues(
      definitions,
      { slika: '11111111-2222-3333-4444-555555555555' },
      resolution,
    );

    expect(values.slika).toBe('https://cdn.test/foto.webp');
  });

  it('obrisana fotografija daje prazno, a ne pokvarenu sliku', () => {
    // Fotografija je obrisana iz galerije posle izbora; `<img src="">` je
    // bolje od `src` koji vodi na 404.
    const values = resolveFieldValues(
      definitions,
      { slika: '99999999-9999-9999-9999-999999999999' },
      resolution,
    );

    expect(values.slika).toBe('');
  });
});

describe('popunjavanje dokumenta', () => {
  it('vrednosti ulaze bekstvovane, a asset tokeni kao adrese', () => {
    const html = renderInvitationHtml({
      document:
        '<h1 id="imena">{{text:imena}}</h1><img id="slika" src="{{attr:slika}}">' +
        '<link href="{{asset:css/stil.css}}">',
      definitions,
      values: { imena: 'Ana & Marko' },
      resolution,
    });

    expect(html).toContain('<h1 id="imena">Ana &amp; Marko</h1>');
    expect(html).toContain('src="/sabloni-fajlovi/v1/img/hero.webp"');
    expect(html).toContain('href="/sabloni-fajlovi/v1/css/stil.css"');
  });
});

describe('rastavljanje popunjenog dokumenta', () => {
  const document = [
    '<!DOCTYPE html><html lang="sr-Latn"><head>',
    '<link rel="stylesheet" href="{{asset:css/stil.css}}">',
    '</head><body class="tamna">',
    '<h1 id="imena">{{text:imena}}</h1>',
    '</body></html>',
  ].join('');

  it('tokeni u glavi se razrešavaju kao i oni u telu', () => {
    // Glava i telo se čitaju na dva mesta (layout i stranica); dok se dokument
    // popunjavao dvaput, u glavi je znalo da ostane doslovno `{{asset:...}}` -
    // i sajt bi ostao bez ijednog svog stila.
    const parts = renderTemplateDocument({
      document,
      definitions,
      values: { imena: 'Ana i Marko' },
      versionId: 'v1',
    });

    expect(parts?.headHtml).toContain('href="/sabloni-fajlovi/v1/css/stil.css"');
    expect(parts?.headHtml).not.toContain('{{');
    expect(parts?.bodyHtml).toContain('<h1 id="imena">Ana i Marko</h1>');
  });

  it('atributi korena ostaju autorovi', () => {
    const parts = renderTemplateDocument({
      document,
      definitions,
      values: {},
      versionId: 'v1',
    });

    expect(parts?.htmlAttributes.lang).toBe('sr-Latn');
    expect(parts?.bodyAttributes.class).toBe('tamna');
  });

  it('dokument koji se ne može rastaviti daje `null`', () => {
    expect(
      renderTemplateDocument({
        document: '<p>bez korena</p>',
        definitions,
        values: {},
        versionId: 'v1',
      }),
    ).toBeNull();
  });
});
