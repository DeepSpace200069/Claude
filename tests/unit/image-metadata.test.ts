import { describe, expect, it } from 'vitest';

import {
  detectImageFormat,
  hasImageMetadata,
  stripImageMetadata,
} from '@/lib/image-metadata';

/**
 * Uklanjanje metapodataka je bezbednosni zahtev (24): fotografija sa telefona
 * nosi GPS lokaciju snimanja, a objavljena pozivnica ne sme da je oda.
 *
 * Testovi rade nad ručno sklopljenim kontejnerima umesto nad pravim slikama:
 * tako se tačno zna šta ulazi, a fajlovi ne moraju da se čuvaju u repozitorijumu.
 */
function bytes(...values: Array<number | string | Uint8Array>): Uint8Array {
  const parts: number[] = [];

  for (const value of values) {
    if (typeof value === 'number') parts.push(value);
    else if (typeof value === 'string') {
      for (const char of value) parts.push(char.charCodeAt(0));
    } else parts.push(...value);
  }

  return new Uint8Array(parts);
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return bytes(0xff, marker, (length >> 8) & 0xff, length & 0xff, payload);
}

function buildJpeg(options: { exif?: boolean; icc?: boolean; comment?: boolean }) {
  return bytes(
    0xff,
    0xd8, // SOI
    jpegSegment(0xe0, bytes('JFIF\0', 1, 1, 0, 0, 72, 0, 72, 0, 0)),
    options.exif ? jpegSegment(0xe1, bytes('Exif\0\0', 0x49, 0x49, 42, 0)) : bytes(),
    options.icc ? jpegSegment(0xe2, bytes('ICC_PROFILE\0', 1, 2, 3)) : bytes(),
    options.comment ? jpegSegment(0xfe, bytes('privatna beleska')) : bytes(),
    jpegSegment(0xda, bytes(1, 1, 0, 0, 63, 0)), // SOS
    bytes(0x11, 0x22, 0x33, 0x44), // "slika"
    0xff,
    0xd9, // EOI
  );
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  return bytes(
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    type,
    data,
    0,
    0,
    0,
    0, // CRC nam nije bitan: izbacujemo cele komade, ne menjamo ih
  );
}

function buildPng(options: { exif?: boolean; text?: boolean }) {
  return bytes(
    0x89,
    'PNG\r\n',
    0x1a,
    0x0a,
    pngChunk('IHDR', bytes(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
    options.exif ? pngChunk('eXIf', bytes(0x49, 0x49, 42, 0, 8, 0, 0, 0)) : bytes(),
    options.text ? pngChunk('tEXt', bytes('Comment\0privatno')) : bytes(),
    pngChunk('IDAT', bytes(1, 2, 3, 4)),
    pngChunk('IEND', bytes()),
  );
}

function riffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const size = data.length;
  const padding = size % 2 === 1 ? [0] : [];
  return bytes(
    fourcc,
    size & 0xff,
    (size >>> 8) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 24) & 0xff,
    data,
    new Uint8Array(padding),
  );
}

function buildWebp(options: { exif?: boolean; xmp?: boolean }) {
  const flags = (options.exif ? 0x08 : 0) | (options.xmp ? 0x04 : 0);

  const payload = bytes(
    'WEBP',
    riffChunk('VP8X', bytes(flags, 0, 0, 0, 0, 0, 0, 0, 0, 0)),
    riffChunk('VP8 ', bytes(1, 2, 3, 4, 5, 6)),
    options.exif ? riffChunk('EXIF', bytes(0x49, 0x49, 42, 0, 8, 0, 0, 0)) : bytes(),
    options.xmp ? riffChunk('XMP ', bytes('<x:xmpmeta/>')) : bytes(),
  );

  return bytes(
    'RIFF',
    payload.length & 0xff,
    (payload.length >>> 8) & 0xff,
    (payload.length >>> 16) & 0xff,
    (payload.length >>> 24) & 0xff,
    payload,
  );
}

function contains(haystack: Uint8Array, needle: string): boolean {
  const target = [...needle].map((char) => char.charCodeAt(0));
  outer: for (let i = 0; i + target.length <= haystack.length; i += 1) {
    for (let j = 0; j < target.length; j += 1) {
      if (haystack[i + j] !== target[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe('prepoznavanje formata', () => {
  it('prepoznaje JPEG, PNG i WebP', () => {
    expect(detectImageFormat(buildJpeg({}))).toBe('jpeg');
    expect(detectImageFormat(buildPng({}))).toBe('png');
    expect(detectImageFormat(buildWebp({}))).toBe('webp');
  });

  it('nepoznat sadržaj nije slika', () => {
    expect(detectImageFormat(bytes('nije slika'))).toBe('unknown');
    expect(detectImageFormat(new Uint8Array(0))).toBe('unknown');
  });

  it('format koji ne umemo da pročitamo se tretira kao sumnjiv', () => {
    // Konzervativno: bolje odbiti fajl nego objaviti fotografiju sa lokacijom.
    expect(hasImageMetadata(bytes('nepoznat kontejner'))).toBe(true);
  });
});

describe('JPEG', () => {
  it('uklanja EXIF i komentar, a zadržava JFIF i ICC profil', () => {
    const input = buildJpeg({ exif: true, icc: true, comment: true });
    expect(hasImageMetadata(input)).toBe(true);

    const result = stripImageMetadata(input);

    expect(result.supported).toBe(true);
    expect(result.removed).toEqual(expect.arrayContaining(['exif', 'text']));
    expect(contains(result.bytes, 'Exif')).toBe(false);
    expect(contains(result.bytes, 'privatna beleska')).toBe(false);
    // Boje ne smeju da se promene: ICC profil nije lični podatak.
    expect(contains(result.bytes, 'ICC_PROFILE')).toBe(true);
    expect(contains(result.bytes, 'JFIF')).toBe(true);
    expect(hasImageMetadata(result.bytes)).toBe(false);
  });

  it('čuva podatke slike posle SOS markera', () => {
    const result = stripImageMetadata(buildJpeg({ exif: true }));
    const tail = result.bytes.subarray(result.bytes.length - 6);

    expect([...tail]).toEqual([0x11, 0x22, 0x33, 0x44, 0xff, 0xd9]);
  });

  it('fajl bez metapodataka se vraća netaknut', () => {
    const input = buildJpeg({ icc: true });
    const result = stripImageMetadata(input);

    expect(result.removed).toEqual([]);
    expect(result.bytes).toBe(input);
    expect(hasImageMetadata(input)).toBe(false);
  });
});

describe('PNG', () => {
  it('izbacuje eXIf i tekstualne komade, a zadržava sliku', () => {
    const input = buildPng({ exif: true, text: true });
    expect(hasImageMetadata(input)).toBe(true);

    const result = stripImageMetadata(input);

    expect(contains(result.bytes, 'eXIf')).toBe(false);
    expect(contains(result.bytes, 'privatno')).toBe(false);
    expect(contains(result.bytes, 'IHDR')).toBe(true);
    expect(contains(result.bytes, 'IDAT')).toBe(true);
    expect(contains(result.bytes, 'IEND')).toBe(true);
    expect(hasImageMetadata(result.bytes)).toBe(false);
  });

  it('čist PNG ostaje nepromenjen', () => {
    const input = buildPng({});
    expect(stripImageMetadata(input).removed).toEqual([]);
    expect(hasImageMetadata(input)).toBe(false);
  });
});

describe('WebP', () => {
  it('izbacuje EXIF i XMP delove i gasi zastavice u VP8X zaglavlju', () => {
    const input = buildWebp({ exif: true, xmp: true });
    expect(hasImageMetadata(input)).toBe(true);

    const result = stripImageMetadata(input);

    expect(result.removed).toEqual(expect.arrayContaining(['exif', 'xmp']));
    expect(contains(result.bytes, 'EXIF')).toBe(false);
    expect(contains(result.bytes, 'XMP ')).toBe(false);
    expect(contains(result.bytes, 'VP8X')).toBe(true);
    expect(contains(result.bytes, 'VP8 ')).toBe(true);
    // Zastavice moraju da prate stvarno stanje, inače bi čitači i dalje
    // tražili blok kog više nema.
    expect(hasImageMetadata(result.bytes)).toBe(false);
  });

  it('ispravlja ukupnu dužinu u RIFF zaglavlju', () => {
    const result = stripImageMetadata(buildWebp({ exif: true }));
    const declared =
      (result.bytes[4] as number) |
      ((result.bytes[5] as number) << 8) |
      ((result.bytes[6] as number) << 16) |
      ((result.bytes[7] as number) << 24);

    expect(declared).toBe(result.bytes.length - 8);
  });

  it('WebP bez metapodataka prolazi bez izmene', () => {
    const input = buildWebp({});
    expect(stripImageMetadata(input).removed).toEqual([]);
    expect(hasImageMetadata(input)).toBe(false);
  });
});
