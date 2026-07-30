/**
 * Čitanje i pisanje CSV-a (zahtev 12, uvoz i izvoz gostiju).
 *
 * Napisano ovde, u stotinak redova, umesto uvođenja biblioteke: format je mali,
 * a jedini delovi koji zaista prave probleme su navodnici i prelomi reda unutar
 * polja - i njih pokrivamo. Zauzvrat imamo tačnu kontrolu nad onim što je za
 * srpske korisnike najvažnije: tačka-zarez kao razdvajač i BOM koji Excel
 * traži da bi „Jovanović" prikazao ispravno.
 */

/**
 * Razdvajač se **prepoznaje**, ne pretpostavlja.
 *
 * Excel na srpskim i nemačkim podešavanjima izvozi sa tačka-zarezom, a skoro
 * svi ostali alati sa zarezom. Korisnik ne treba da zna koji ima - fajl koji
 * mu je alat dao mora prosto da radi.
 */
export function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? '';
  const counts = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  };

  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

/**
 * Parsira CSV u niz redova.
 *
 * Prolazi znak po znak umesto `split` po razdvajaču: polje sme da sadrži i
 * razdvajač i prelom reda ako je pod navodnicima, a `split` bi takav red
 * pocepao na pola.
 */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = stripBom(input);
  const separator = delimiter ?? detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (insideQuotes) {
      if (char === '"') {
        // Dvostruki navodnik unutar navodnika je znak navodnika u sadržaju.
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      insideQuotes = true;
      continue;
    }

    if (char === separator) {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      // `\r\n` je jedan prelom, ne dva.
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  // Poslednji red često nema prelom na kraju.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Prazni redovi na kraju fajla nisu podatak.
  return rows.filter((entries) => entries.some((value) => value.trim() !== ''));
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

/**
 * Pravi CSV iz redova.
 *
 * `withBom` podrazumevano stoji: bez BOM-a Excel na Windowsu otvori UTF-8 fajl
 * kao Windows-1252 i sva naša slova postanu smeće. Alati koji BOM ne očekuju
 * ga preskaču bez problema, pa je ovo bezbedniji podrazumevani izbor.
 */
export function toCsv<T>(
  rows: readonly T[],
  columns: ReadonlyArray<CsvColumn<T>>,
  options: { delimiter?: string; withBom?: boolean } = {},
): string {
  const delimiter = options.delimiter ?? ';';
  const lines = [
    columns.map((column) => escapeCsvField(column.header, delimiter)).join(delimiter),
    ...rows.map((row) =>
      columns
        .map((column) => escapeCsvField(formatValue(column.value(row)), delimiter))
        .join(delimiter),
    ),
  ];

  // `\r\n` je ono što Excel očekuje.
  const body = lines.join('\r\n');
  return options.withBom === false ? body : `﻿${body}`;
}

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'da' : 'ne';
  return String(value);
}

/**
 * Polje se navodi kada sadrži razdvajač, navodnik ili prelom reda.
 *
 * Vrednost koja počinje sa `=`, `+`, `-` ili `@` dodatno dobija apostrof:
 * Excel bi je inače protumačio kao formulu, što je poznat način da se kroz
 * naizgled bezopasan spisak gostiju izvrši komanda na tuđem računaru.
 */
export function escapeCsvField(value: string, delimiter: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  const needsQuotes =
    guarded.includes(delimiter) ||
    guarded.includes('"') ||
    guarded.includes('\n') ||
    guarded.includes('\r');

  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

/**
 * Mapira zaglavlje kolona na poznata imena.
 *
 * Prihvata i srpske i engleske nazive, sa ili bez dijakritike, jer fajl obično
 * dolazi iz tuđe tabele - i najčešće nije napravljen za nas.
 */
export function matchColumn(
  header: string,
  candidates: readonly string[],
): boolean {
  const normalized = normalizeHeader(header);
  return candidates.some((candidate) => normalizeHeader(candidate) === normalized);
}

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
