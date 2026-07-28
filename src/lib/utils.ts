import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Spaja Tailwind klase i razrešava konflikte (npr. `p-2` + `p-4` -> `p-4`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Vraća vrednost ograničenu na zadati opseg. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Deli niz u grupe po zadatom ključu. */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = result.get(key);
    if (bucket) bucket.push(item);
    else result.set(key, [item]);
  }
  return result;
}

/** Uklanja `undefined` vrednosti iz objekta (korisno pri parcijalnom update-u). */
export function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}
