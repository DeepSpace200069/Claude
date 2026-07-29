/**
 * Uklanjanje metapodataka iz fotografija (zahtev 24).
 *
 * Fotografija sa telefona nosi EXIF blok u kome je, između ostalog, i tačna GPS
 * lokacija na kojoj je snimljena. Objavljena pozivnica ne sme da oda adresu
 * stana samo zato što je slika slikana kod kuće.
 *
 * Implementirano bez ijedne zavisnosti: parsiranje kontejnera je nekoliko
 * desetina redova, a biblioteka za obradu slika bi u serverless bundle donela
 * desetine megabajta. Radi i u pregledaču i na serveru - koristi samo
 * `Uint8Array`.
 *
 * Podržani formati su tačno oni koje primamo pri otpremanju (JPEG, PNG, WebP).
 * AVIF i HEIC se **ne primaju**: njihove metapodatke ne bismo mogli da uklonimo
 * pouzdano, a klijent ionako prekodira svaku fotografiju u WebP pre slanja.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

export type StripResult = {
  bytes: Uint8Array;
  format: ImageFormat;
  /** Da li smo format uopšte umeli da obradimo. */
  supported: boolean;
  /** Koje vrste metapodataka su uklonjene (`exif`, `xmp`, `iptc`, `text`). */
  removed: string[];
};

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectImageFormat(bytes: Uint8Array): ImageFormat {
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    return 'webp';
  }
  return 'unknown';
}

/** Uklanja metapodatke i vraća novi bafer; original se ne menja. */
export function stripImageMetadata(bytes: Uint8Array): StripResult {
  const format = detectImageFormat(bytes);

  switch (format) {
    case 'jpeg':
      return stripJpeg(bytes);
    case 'png':
      return stripPng(bytes);
    case 'webp':
      return stripWebp(bytes);
    default:
      return { bytes, format, supported: false, removed: [] };
  }
}

/**
 * Da li u baferu ima zaostalih metapodataka.
 *
 * Koristi se posle otpremanja, na **početnim bajtovima** fajla pročitanim iz
 * storage-a. Kod JPEG-a i PNG-a su svi zanimljivi segmenti pre same slike, a
 * kod WebP-a postojanje EXIF/XMP dela stoji u zastavicama `VP8X` zaglavlja - i
 * jedno i drugo staje u prvih nekoliko desetina kilobajta.
 */
export function hasImageMetadata(bytes: Uint8Array): boolean {
  const format = detectImageFormat(bytes);

  switch (format) {
    case 'jpeg':
      return stripJpeg(bytes, { detectOnly: true }).removed.length > 0;
    case 'png':
      return stripPng(bytes, { detectOnly: true }).removed.length > 0;
    case 'webp':
      return webpHasMetadataFlags(bytes);
    default:
      // Format koji ne umemo da pročitamo tretiramo kao sumnjiv.
      return true;
  }
}

// --- JPEG -------------------------------------------------------------------

/**
 * JPEG je niz segmenata: `FF <marker> <dužina:2>` pa sadržaj.
 *
 * Bacamo `APP1` (EXIF i XMP), `APP13` (IPTC/Photoshop) i `COM` (komentar).
 * `APP0` (JFIF) i `APP2` (ICC profil boja) ostaju - nisu lični podaci, a bez
 * ICC profila bi se boje na nekim ekranima prikazale drugačije nego u originalu.
 */
function stripJpeg(
  bytes: Uint8Array,
  options: { detectOnly?: boolean } = {},
): StripResult {
  const removed: string[] = [];
  const keep: Array<[number, number]> = [];
  let offset = 2; // preskačemo SOI
  let cursor = 0;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1] as number;

    // Markeri bez dužine: RSTn i TEM.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // Od SOS-a nadalje ide komprimovana slika - ostatak ide netaknut.
    if (marker === 0xda) break;

    const length = ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    if (length < 2) break;

    const segmentEnd = offset + 2 + length;
    if (segmentEnd > bytes.length) break;

    const label =
      marker === 0xe1
        ? jpegApp1Label(bytes, offset + 4, segmentEnd)
        : marker === 0xed
          ? 'iptc'
          : marker === 0xfe
            ? 'text'
            : null;

    if (label) {
      removed.push(label);
      if (!options.detectOnly) {
        keep.push([cursor, offset]);
        cursor = segmentEnd;
      }
    }

    offset = segmentEnd;
  }

  if (options.detectOnly || removed.length === 0) {
    return { bytes, format: 'jpeg', supported: true, removed: unique(removed) };
  }

  keep.push([cursor, bytes.length]);
  return {
    bytes: concatRanges(bytes, keep),
    format: 'jpeg',
    supported: true,
    removed: unique(removed),
  };
}

function jpegApp1Label(bytes: Uint8Array, start: number, end: number): string {
  const header = ascii(bytes, start, Math.min(29, end - start));
  if (header.startsWith('Exif')) return 'exif';
  if (header.startsWith('http://ns.adobe.com/xap')) return 'xmp';
  // Nepoznat APP1 sadržaj takođe uklanjamo: tu ne živi ništa što slika treba.
  return 'exif';
}

// --- PNG --------------------------------------------------------------------

/**
 * PNG je niz komada: `<dužina:4> <tip:4> <sadržaj> <CRC:4>`.
 *
 * Bacamo `eXIf` i tekstualne komade (`tEXt`, `zTXt`, `iTXt` - tu se često nađe
 * XMP). CRC se ne mora ponovo računati jer izbacujemo cele komade.
 */
const PNG_DROP: Record<string, string> = {
  eXIf: 'exif',
  tEXt: 'text',
  zTXt: 'text',
  iTXt: 'xmp',
};

function stripPng(
  bytes: Uint8Array,
  options: { detectOnly?: boolean } = {},
): StripResult {
  const removed: string[] = [];
  const keep: Array<[number, number]> = [];
  let offset = 8;
  let cursor = 0;

  while (offset + 8 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) break;

    const label = PNG_DROP[type];
    if (label) {
      removed.push(label);
      if (!options.detectOnly) {
        keep.push([cursor, offset]);
        cursor = chunkEnd;
      }
    }

    offset = chunkEnd;
    if (type === 'IEND') break;
  }

  if (options.detectOnly || removed.length === 0) {
    return { bytes, format: 'png', supported: true, removed: unique(removed) };
  }

  keep.push([cursor, bytes.length]);
  return {
    bytes: concatRanges(bytes, keep),
    format: 'png',
    supported: true,
    removed: unique(removed),
  };
}

// --- WebP -------------------------------------------------------------------

const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

/**
 * WebP je RIFF kontejner: `RIFF <dužina:4LE> WEBP` pa niz delova
 * `<oznaka:4> <dužina:4LE> <sadržaj>` sa dopunom do parne dužine.
 *
 * Bacamo delove `EXIF` i `XMP `, gasimo odgovarajuće zastavice u `VP8X`
 * zaglavlju i ispravljamo ukupnu dužinu u RIFF zaglavlju.
 */
function stripWebp(
  bytes: Uint8Array,
  options: { detectOnly?: boolean } = {},
): StripResult {
  const removed: string[] = [];
  const parts: Uint8Array[] = [];
  let offset = 12;
  let vp8xFlagsIndex = -1;

  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, 4);
    const size = readUint32LE(bytes, offset + 4);
    const padded = size + (size % 2);
    const chunkEnd = offset + 8 + padded;
    if (chunkEnd > bytes.length) break;

    if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      removed.push(fourcc === 'EXIF' ? 'exif' : 'xmp');
    } else {
      if (fourcc === 'VP8X') vp8xFlagsIndex = parts.length;
      parts.push(bytes.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  if (webpHasMetadataFlags(bytes) && removed.length === 0) {
    // Zastavica kaže da metapodaci postoje, ali ih nema u delovima koje smo
    // pročitali (skraćen bafer). Prijavljujemo da bi provera bila konzervativna.
    removed.push('exif');
  }

  if (options.detectOnly || removed.length === 0) {
    return { bytes, format: 'webp', supported: true, removed: unique(removed) };
  }

  const vp8x = vp8xFlagsIndex >= 0 ? parts[vp8xFlagsIndex] : undefined;
  if (vp8x && vp8x.length > 8) {
    const patched = new Uint8Array(vp8x);
    patched[8] = (patched[8] as number) & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG);
    parts[vp8xFlagsIndex] = patched;
  }

  const payloadLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(12 + payloadLength);
  output.set(bytes.subarray(0, 12), 0);
  // RIFF dužina broji sve posle prva 4 bajta dužine, uključujući oznaku `WEBP`.
  writeUint32LE(output, 4, payloadLength + 4);

  let write = 12;
  for (const part of parts) {
    output.set(part, write);
    write += part.length;
  }

  return { bytes: output, format: 'webp', supported: true, removed: unique(removed) };
}

function webpHasMetadataFlags(bytes: Uint8Array): boolean {
  if (bytes.length < 21) return false;
  if (ascii(bytes, 12, 4) !== 'VP8X') return false;
  const flags = bytes[20] as number;
  return (flags & (VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) !== 0;
}

// --- Sitni pomoćnici --------------------------------------------------------

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i] as number);
  }
  return out;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] as number) << 24) |
    ((bytes[offset + 1] as number) << 16) |
    ((bytes[offset + 2] as number) << 8) |
    (bytes[offset + 3] as number)
  ) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] as number) |
    ((bytes[offset + 1] as number) << 8) |
    ((bytes[offset + 2] as number) << 16) |
    ((bytes[offset + 3] as number) << 24)
  ) >>> 0;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function concatRanges(bytes: Uint8Array, ranges: Array<[number, number]>): Uint8Array {
  const total = ranges.reduce((sum, [start, end]) => sum + (end - start), 0);
  const output = new Uint8Array(total);
  let write = 0;
  for (const [start, end] of ranges) {
    output.set(bytes.subarray(start, end), write);
    write += end - start;
  }
  return output;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
