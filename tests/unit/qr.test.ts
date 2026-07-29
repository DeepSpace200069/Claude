import { describe, expect, it } from 'vitest';

import { qrDataUrl, qrModules, qrSvg } from '@/features/invitations/qr';
import { qrPng } from '@/features/invitations/qr-png';
import { detectImageFormat, hasImageMetadata } from '@/lib/image-metadata';

/**
 * QR kod za javni link (zahtev 4.5).
 *
 * Kodiranje radi proverena biblioteka, pa se ovde ne testira sam algoritam nego
 * ono što je naše: da je struktura koda ispravna, da SVG i PNG odgovaraju istoj
 * matrici i da izlaz zaista jeste slika koju spoljni alat može da otvori.
 */
const URL = 'https://pozivnica.rs/p/ana-i-marko-2027';

describe('matrica QR koda', () => {
  it('kvadratna je i dovoljno velika za link pozivnice', () => {
    const modules = qrModules(URL);

    expect(modules.length).toBeGreaterThanOrEqual(21);
    for (const row of modules) expect(row).toHaveLength(modules.length);
  });

  it('ima tri šablona za pronalaženje, u tri ugla', () => {
    const modules = qrModules(URL);
    const size = modules.length;

    // Spoljni prsten šablona je 7x7 sa tamnim ivicama - po tome ga čitač i nađe.
    const hasFinder = (top: number, left: number) =>
      [0, 1, 2, 3, 4, 5, 6].every(
        (offset) =>
          modules[top]?.[left + offset] === true &&
          modules[top + 6]?.[left + offset] === true &&
          modules[top + offset]?.[left] === true &&
          modules[top + offset]?.[left + 6] === true,
      );

    expect(hasFinder(0, 0)).toBe(true);
    expect(hasFinder(0, size - 7)).toBe(true);
    expect(hasFinder(size - 7, 0)).toBe(true);

    // Četvrti ugao je namerno bez šablona - po njemu čitač određuje orijentaciju.
    expect(hasFinder(size - 7, size - 7)).toBe(false);
  });

  it('duži sadržaj traži veći kod', () => {
    const short = qrModules('https://pozivnica.rs/p/a');
    const long = qrModules(`https://pozivnica.rs/p/${'x'.repeat(200)}`);

    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe('SVG', () => {
  it('sadrži prazan okvir oko koda', () => {
    const modules = qrModules(URL);
    const svg = qrSvg(URL);

    // `viewBox` je veći od matrice za po četiri modula sa svake strane.
    expect(svg).toContain(`viewBox="0 0 ${modules.length + 8} ${modules.length + 8}"`);
  });

  it('poštuje zadatu veličinu i boju', () => {
    const svg = qrSvg(URL, { size: 320, color: '#123456' });

    expect(svg).toContain('width="320"');
    expect(svg).toContain('fill="#123456"');
  });

  it('bez pozadine ne crta beli pravougaonik', () => {
    expect(qrSvg(URL, { background: null })).not.toContain('<rect');
    expect(qrSvg(URL)).toContain('<rect');
  });

  it('`data:` URL je ispravno kodiran SVG', () => {
    const url = qrDataUrl(URL);

    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = Buffer.from(url.split(',')[1] ?? '', 'base64').toString('utf8');
    expect(decoded).toBe(qrSvg(URL));
  });
});

describe('PNG', () => {
  it('daje ispravan PNG bez metapodataka', () => {
    const png = new Uint8Array(qrPng(URL, 4));

    expect(detectImageFormat(png)).toBe('png');
    expect(hasImageMetadata(png)).toBe(false);
  });

  it('dimenzije prate matricu i zadatu razmeru', () => {
    const scale = 6;
    const png = qrPng(URL, scale);
    const expected = (qrModules(URL).length + 8) * scale;

    // IHDR je odmah posle potpisa: širina na 16, visina na 20.
    expect(png.readUInt32BE(16)).toBe(expected);
    expect(png.readUInt32BE(20)).toBe(expected);
    // Tip boje 0 = sivo bez alfa kanala.
    expect(png[25]).toBe(0);
  });

  it('isti sadržaj daje isti fajl', () => {
    expect(qrPng(URL, 4).equals(qrPng(URL, 4))).toBe(true);
  });
});
