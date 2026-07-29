import 'server-only';

import { headers } from 'next/headers';

import { hashToken } from '@/lib/ids';

/**
 * Otisak klijenta za ograničavanje broja pokušaja (zahtev 24).
 *
 * Namerno **heš**, a ne sama IP adresa: ograničavanje pokušaja ne traži da
 * znamo ko je posetilac, samo da razlikujemo posetioce međusobno. Heš se nigde
 * ne upisuje - živi koliko i in-memory brojač.
 *
 * Iza obrnutog proksija je `x-forwarded-for` jedini izvor prave adrese; prva
 * vrednost u listi je klijent, ostale su proksiji.
 */
export async function clientFingerprint(): Promise<string> {
  const store = await headers();

  const forwarded = store.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    store.get('x-real-ip')?.trim() ||
    'nepoznato';

  // Uz adresu ide i korisnički agent, da posetioci iza istog NAT-a ne bi delili
  // isti brojač; heš ih spaja u jedan neprozirni ključ.
  return hashToken(`${ip}|${store.get('user-agent') ?? ''}`).slice(0, 32);
}

/** Da li je posetilac već bio na ovoj pozivnici u ovoj sesiji pregledača. */
export function isFirstVisitHeader(value: string | null): boolean {
  return value !== 'ponovljena';
}
