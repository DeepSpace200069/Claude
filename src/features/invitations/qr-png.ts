import { deflateSync } from 'node:zlib';

import { qrModules } from './qr';

/**
 * QR kod kao PNG (zahtev 4.5).
 *
 * Za štampu na papirnoj pozivnici ili zahvalnici SVG nije uvek dovoljan -
 * štamparije i uređivači teksta traže rasterski fajl.
 *
 * Enkoder je napisan ovde, u pedesetak redova, umesto uvođenja biblioteke za
 * obradu slika: QR je crno-bela mreža bez prelaza, pa je PNG za nju najprostiji
 * mogući - sivo, osam bita po pikselu, bez palete i bez providnosti. Alternativa
 * bi bila `ImageResponse`, koja za ovakav posao učitava fontove i rasterizator.
 */

/** Koliko piksela ima jedan modul; 16 daje ~600 px za tipičan kod. */
const DEFAULT_SCALE = 16;

/** Prazan okvir oko koda, u modulima - ispod četiri čitači počinju da promašuju. */
const QUIET_ZONE = 4;

export function qrPng(text: string, scale = DEFAULT_SCALE): Buffer {
  const modules = qrModules(text);
  const count = modules.length;
  const side = (count + QUIET_ZONE * 2) * scale;

  // Sivi kanal: 0 = crno, 255 = belo. Svaka linija počinje bajtom filtera (0).
  const raw = Buffer.alloc((side + 1) * side, 0xff);

  for (let y = 0; y < side; y += 1) {
    const lineStart = y * (side + 1);
    raw[lineStart] = 0;

    const moduleRow = Math.floor(y / scale) - QUIET_ZONE;
    const row = moduleRow >= 0 && moduleRow < count ? modules[moduleRow] : undefined;
    if (!row) continue;

    for (let x = 0; x < side; x += 1) {
      const moduleColumn = Math.floor(x / scale) - QUIET_ZONE;
      if (moduleColumn < 0 || moduleColumn >= count) continue;
      if (row[moduleColumn]) raw[lineStart + 1 + x] = 0x00;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // dubina po kanalu
  ihdr[9] = 0; // sivo, bez alfa kanala
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // podrazumevani filter
  ihdr[12] = 0; // bez preplitanja

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));

  return Buffer.concat([length, typeAndData, crc]);
}

/** CRC-32 po PNG specifikaciji; tabela se računa jednom, pri prvom pozivu. */
let crcTable: Uint32Array | null = null;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[index] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crcTable[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
