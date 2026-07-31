import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/server/db';

/**
 * Provera zdravlja za balanser i nadzor (zahtev 8.8).
 *
 * Proverava **jednu** stvar koja zaista može da otkaže nezavisno od koda: da li
 * baza odgovara. Provera koja uvek vraća „ok” ne služi ničemu, a provera koja
 * obilazi pola aplikacije pravi lažne uzbune kada zaškripi nešto nebitno.
 *
 * Odgovor se nikad ne kešira i ne otkriva verziju ni druge detalje - to je
 * podatak za napadača, a ne za balanser.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const started = Date.now();

  try {
    await db.execute(sql`select 1`);

    return NextResponse.json(
      { status: 'ok', durationMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Bez poruke greške u odgovoru: detalji idu u log servera, ne posetiocu.
    return NextResponse.json(
      { status: 'degraded' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
