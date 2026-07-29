import qrcode from 'qrcode-generator';

/**
 * QR kod za javni link pozivnice (zahtev 4.5).
 *
 * Kodiranje radi `qrcode-generator` - jedna od retkih zavisnosti koju projekat
 * uzima gotovu. Razlog je konkretan: sam algoritam je Reed-Solomon korekcija
 * grešaka, osam maski sa bodovanjem i BCH kodovi za zaglavlje, a suptilna
 * greška daje kod koji jedan telefon pročita, a drugi ne. To je tačno vrsta
 * posla gde je proverena implementacija bolja od naše.
 *
 * SVG pravimo sami: biblioteka nudi svoj ispis, ali on nosi fiksne boje i
 * atribute. Ovako kod nasleđuje boju teksta i može se štampati u bilo kojoj
 * boji, a i preuzeti kao samostalan fajl.
 */

/**
 * Nivo korekcije grešaka.
 *
 * `M` (oko 15%) je pravi izbor za štampu na pozivnici: kod ostaje čitljiv i
 * kada se papir malo izgužva ili se preko ugla nađe ukras, a ne postaje
 * pregust kao na nivou `Q` ili `H`.
 */
const ERROR_CORRECTION = 'M' as const;

/** Prazan okvir oko koda, u modulima. Ispod četiri čitači počinju da promašuju. */
const QUIET_ZONE = 4;

export type QrOptions = {
  /** Veličina strane u pikselima kada se kod koristi kao slika. */
  size?: number;
  /** Boja modula; podrazumevano nasleđuje boju teksta. */
  color?: string;
  background?: string | null;
};

function buildMatrix(text: string): boolean[][] {
  // `0` znači „izaberi najmanju verziju u koju sadržaj staje”.
  const qr = qrcode(0, ERROR_CORRECTION);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => qr.isDark(row, column)),
  );
}

/** Matrica modula - koriste je i SVG i testovi. */
export function qrModules(text: string): boolean[][] {
  return buildMatrix(text);
}

/**
 * QR kod kao SVG.
 *
 * Svi tamni moduli idu u **jednu** `<path>` putanju umesto u hiljadu
 * pravougaonika: fajl je nekoliko puta manji, a pregledač ga crta u jednom
 * prolazu.
 */
export function qrSvg(text: string, options: QrOptions = {}): string {
  const modules = buildMatrix(text);
  const count = modules.length;
  const side = count + QUIET_ZONE * 2;
  const size = options.size ?? 512;
  const color = options.color ?? 'currentColor';

  const commands: string[] = [];

  for (let row = 0; row < count; row += 1) {
    const line = modules[row];
    if (!line) continue;

    let column = 0;
    while (column < count) {
      if (!line[column]) {
        column += 1;
        continue;
      }

      // Susedni tamni moduli u istom redu se spajaju u jedan potez.
      let width = 1;
      while (column + width < count && line[column + width]) width += 1;

      commands.push(
        `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h${width}v1h-${width}z`,
      );
      column += width;
    }
  }

  const background =
    options.background === null
      ? ''
      : `<rect width="${side}" height="${side}" fill="${options.background ?? '#ffffff'}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"`,
    ` width="${size}" height="${size}" shape-rendering="crispEdges" role="img">`,
    background,
    `<path fill="${color}" d="${commands.join('')}"/>`,
    '</svg>',
  ].join('');
}

/** SVG kao `data:` URL - koristi ga generisanje PNG-a i pregled u interfejsu. */
export function qrDataUrl(text: string, options: QrOptions = {}): string {
  const svg = qrSvg(text, options);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
