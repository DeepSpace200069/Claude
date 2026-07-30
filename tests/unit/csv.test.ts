import { describe, expect, it } from 'vitest';

import {
  detectDelimiter,
  escapeCsvField,
  matchColumn,
  normalizeHeader,
  parseCsv,
  toCsv,
} from '@/lib/csv';

/**
 * CSV je format koji „skoro radi" u devedeset posto slučajeva, a preostalih
 * deset posto su tačno oni fajlovi koje korisnik zaista ima: iz srpskog Excela,
 * sa navodnicima oko prezimena i prelomom reda u napomeni.
 */
describe('prepoznavanje razdvajača', () => {
  it('prepoznaje tačka-zarez iz srpskog Excela', () => {
    expect(detectDelimiter('Ime;Prezime;Email')).toBe(';');
  });

  it('prepoznaje zarez', () => {
    expect(detectDelimiter('Ime,Prezime,Email')).toBe(',');
  });

  it('prepoznaje tabulator', () => {
    expect(detectDelimiter('Ime\tPrezime\tEmail')).toBe('\t');
  });

  it('gleda samo prvi red, a ne ceo fajl', () => {
    // U podacima ima zareza (u napomeni), ali zaglavlje je jasno.
    expect(detectDelimiter('Ime;Napomena\nMarko;dolazi, ali kasni')).toBe(';');
  });
});

describe('parsiranje', () => {
  it('čita obične redove', () => {
    expect(parseCsv('Ime;Prezime\nMarko;Ilić')).toEqual([
      ['Ime', 'Prezime'],
      ['Marko', 'Ilić'],
    ]);
  });

  it('razdvajač unutar navodnika ostaje deo vrednosti', () => {
    const rows = parseCsv('Ime;Domaćinstvo\nMarko;"Petrović; Jović"');
    expect(rows[1]).toEqual(['Marko', 'Petrović; Jović']);
  });

  it('prelom reda unutar navodnika ne cepa red', () => {
    const rows = parseCsv('Ime;Napomena\nMarko;"prvi red\ndrugi red"');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[1]).toBe('prvi red\ndrugi red');
  });

  it('dvostruki navodnik je znak navodnika u sadržaju', () => {
    const rows = parseCsv('Ime\n"Marko ""Mare"" Ilić"');
    expect(rows[1]?.[0]).toBe('Marko "Mare" Ilić');
  });

  it('uklanja BOM koji Excel piše na početak fajla', () => {
    expect(parseCsv('﻿Ime;Prezime')[0]).toEqual(['Ime', 'Prezime']);
  });

  it('`\\r\\n` je jedan prelom, ne dva', () => {
    expect(parseCsv('Ime\r\nMarko\r\n')).toEqual([['Ime'], ['Marko']]);
  });

  it('prazni redovi na kraju nisu podatak', () => {
    expect(parseCsv('Ime\nMarko\n\n\n')).toEqual([['Ime'], ['Marko']]);
  });
});

describe('pisanje', () => {
  it('piše BOM da bi Excel prikazao naša slova', () => {
    const csv = toCsv([{ ime: 'Jovanović' }], [
      { header: 'Ime', value: (row) => row.ime },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('navodi polje koje sadrži razdvajač', () => {
    expect(escapeCsvField('Petrović; Jović', ';')).toBe('"Petrović; Jović"');
  });

  it('vrednost koja liči na formulu dobija apostrof', () => {
    // Bez ovoga bi Excel na tuđem računaru pokušao da izvrši sadržaj polja.
    expect(escapeCsvField('=SUM(A1)', ';')).toBe("'=SUM(A1)");
    expect(escapeCsvField('+1 11 234567', ';')).toBe("'+1 11 234567");
    expect(escapeCsvField('@kolega', ';')).toBe("'@kolega");
  });

  it('obična vrednost ostaje netaknuta', () => {
    expect(escapeCsvField('Marko Ilić', ';')).toBe('Marko Ilić');
  });

  it('prolazi kroz ceo krug pisanja i čitanja', () => {
    const csv = toCsv(
      [{ ime: 'Marko', napomena: 'dolazi; kasni\nsa detetom' }],
      [
        { header: 'Ime', value: (row) => row.ime },
        { header: 'Napomena', value: (row) => row.napomena },
      ],
    );

    const rows = parseCsv(csv);
    expect(rows[1]).toEqual(['Marko', 'dolazi; kasni\nsa detetom']);
  });
});

describe('prepoznavanje kolona', () => {
  it('ignoriše dijakritiku, razmake i velika slova', () => {
    expect(normalizeHeader('  Prezîme ')).toBe('prezime');
    expect(matchColumn(' Prezime ', ['prezime'])).toBe(true);
    expect(matchColumn('E-mail', ['email'])).toBe(true);
  });

  it('prihvata i srpski i engleski naziv', () => {
    expect(matchColumn('Ime', ['ime', 'first name'])).toBe(true);
    expect(matchColumn('First Name', ['ime', 'first name'])).toBe(true);
  });

  it('ne poklapa tuđu kolonu', () => {
    expect(matchColumn('Adresa', ['ime', 'prezime'])).toBe(false);
  });
});
