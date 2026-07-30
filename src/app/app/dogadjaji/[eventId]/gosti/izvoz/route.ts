import { NextResponse } from 'next/server';

import { toCsv } from '@/lib/csv';
import { requireEventAccess } from '@/server/authz';
import { isKnownError } from '@/server/authz/errors';
import { loadGuestsForExport, type GuestRow } from '@/server/services/guests';

/**
 * Izvoz spiska gostiju u CSV (zahtev 12).
 *
 * Podaci gostiju su lični, pa ruta traži dozvolu `guests:view` i odgovor se
 * nikad ne kešira. Fajl namerno sadrži i privatnu belešku: to je organizatorov
 * podatak koji izvozi za sebe - ali baš zato ne sme da procuri kroz keš ili
 * kroz link koji neko prosledi dalje.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  try {
    await requireEventAccess(eventId, 'guests:view');

    const guests = await loadGuestsForExport(eventId);
    const csv = toCsv(guests, COLUMNS);

    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="gosti-${today}.csv"`,
        'cache-control': 'no-store, private',
      },
    });
  } catch (error) {
    if (isKnownError(error)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

/** Zaglavlja su na srpskom - isti nazivi koje uvoz prepoznaje. */
const COLUMNS = [
  { header: 'Ime', value: (row: GuestRow) => row.firstName },
  { header: 'Prezime', value: (row: GuestRow) => row.lastName },
  { header: 'Email', value: (row: GuestRow) => row.email },
  { header: 'Telefon', value: (row: GuestRow) => row.phone },
  { header: 'Domaćinstvo', value: (row: GuestRow) => row.householdName },
  { header: 'Dete', value: (row: GuestRow) => row.isChild },
  { header: 'Oznake', value: (row: GuestRow) => row.tags.join(', ') },
  {
    header: 'Odgovor',
    value: (row: GuestRow) => RESPONSE_LABELS[row.rsvpStatus ?? 'pending'],
  },
  { header: 'Napomena', value: (row: GuestRow) => row.privateNote },
] as const;

const RESPONSE_LABELS: Record<'pending' | 'yes' | 'no' | 'maybe', string> = {
  pending: 'Bez odgovora',
  yes: 'Dolazi',
  no: 'Ne dolazi',
  maybe: 'Možda',
};
