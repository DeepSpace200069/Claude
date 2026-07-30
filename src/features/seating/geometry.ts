/**
 * Geometrija i imenovanje stolova.
 *
 * Čiste funkcije, bez baze i bez React-a, jer ista pravila važe na dva mesta:
 * dok organizator vuče sto po platnu (klijent) i kada se položaj upisuje
 * (server). Da su napisana dvaput, pre ili kasnije bi se razišla.
 */

export const MIN_TABLE_SIZE = 40;
export const MAX_TABLE_SIZE = 800;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 40;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rotacija se svodi na 0–359 stepeni, i za negativne uglove. */
export function normalizeRotation(value: number): number {
  const rounded = Math.round(value) % 360;
  return rounded < 0 ? rounded + 360 : rounded;
}

export function clampTableSize(value: number): number {
  return clamp(Math.round(value), MIN_TABLE_SIZE, MAX_TABLE_SIZE);
}

export function clampCapacity(value: number): number {
  return clamp(Math.round(value), MIN_CAPACITY, MAX_CAPACITY);
}

/**
 * Zadržava sto unutar sale.
 *
 * Sto koji „ispadne" sa platna nije greška podataka, ali jeste izgubljen sto:
 * organizator ga ne vidi, a i dalje broji goste. Zato se položaj skraćuje na
 * granice sale, uz uslov da sto koji je širi od sale ostane na nuli umesto da
 * odleti u negativno.
 */
export function clampToRoom(
  position: { x: number; y: number },
  table: { width: number; height: number },
  room: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: clamp(Math.round(position.x), 0, Math.max(0, room.width - table.width)),
    y: clamp(Math.round(position.y), 0, Math.max(0, room.height - table.height)),
  };
}

/**
 * Prvi slobodan redni broj mesta.
 *
 * Rupe se popunjavaju pre nego što se raste: kada neko ustane sa mesta 2, sledeći
 * gost sedne na 2, a ne na 9.
 */
export function nextFreeSeat(taken: ReadonlyArray<number | null>): number {
  const used = new Set(taken.filter((value): value is number => value !== null));
  let seat = 1;
  while (used.has(seat)) seat += 1;
  return seat;
}

/**
 * Slobodan naziv stola u sali.
 *
 * Naziv je jedinstven (baza to i traži), ali umesto greške „naziv je zauzet"
 * dodajemo sufiks. Organizator koji duplira sto ne treba da smišlja ime, a onaj
 * koji ga ručno preimenuje ne sme da ostane bez sačuvane izmene.
 */
export function nextTableName(
  taken: ReadonlySet<string>,
  desired: string,
): string | null {
  if (!taken.has(desired)) return desired;

  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${desired} (${suffix})`;
    if (!taken.has(candidate)) return candidate;
  }

  return null;
}
