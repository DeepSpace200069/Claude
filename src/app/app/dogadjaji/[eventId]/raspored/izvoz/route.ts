import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toCsv, type CsvColumn } from '@/lib/csv';
import { requireEventAccess } from '@/server/authz';
import { isKnownError } from '@/server/authz/errors';
import { getSeatingPlan } from '@/server/services/seating';

/**
 * Izvoz rasporeda u CSV (zahtev 14.7).
 *
 * Jedan red po gostu, a ne jedan red po stolu sa nabrajanjem imena: tako se
 * spisak može sortirati po imenu (ko gde sedi), po stolu (ko je za kojim) i
 * uvesti u bilo koju tabelu bez ručnog razdvajanja.
 *
 * Neraspoređeni gosti su takođe u fajlu, sa praznim stolom - spisak koji ih
 * prećuti izgledao bi kao da su svi raspoređeni.
 */
type ExportRow = {
  room: string;
  table: string;
  capacity: number;
  seat: number | null;
  guest: string;
  isChild: boolean;
  notes: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  try {
    await requireEventAccess(eventId, 'seating:view');

    const requested = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get('verzija'));

    const plan = await getSeatingPlan(
      eventId,
      requested.success ? requested.data : undefined,
    );

    const rows: ExportRow[] = [];

    for (const room of plan.rooms) {
      for (const table of room.tables) {
        for (const guest of table.guests) {
          rows.push({
            room: room.name,
            table: table.name,
            capacity: table.capacity,
            seat: guest.seatNumber,
            guest: guest.name,
            isChild: guest.isChild,
            notes: table.notes ?? '',
          });
        }
      }
    }

    for (const guest of plan.unseated) {
      rows.push({
        room: '',
        table: '',
        capacity: 0,
        seat: null,
        guest: guest.name,
        isChild: guest.isChild,
        notes: '',
      });
    }

    const csv = toCsv(rows, COLUMNS);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="raspored-${today}.csv"`,
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

const COLUMNS: Array<CsvColumn<ExportRow>> = [
  { header: 'Sala', value: (row) => row.room },
  { header: 'Sto', value: (row) => row.table },
  { header: 'Mesto', value: (row) => row.seat },
  { header: 'Gost', value: (row) => row.guest },
  { header: 'Dete', value: (row) => row.isChild },
  { header: 'Broj mesta za stolom', value: (row) => (row.capacity || '') },
  { header: 'Napomena', value: (row) => row.notes },
];
