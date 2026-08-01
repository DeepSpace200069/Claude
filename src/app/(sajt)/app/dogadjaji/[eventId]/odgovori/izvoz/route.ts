import { NextResponse } from 'next/server';

import { formatAnswerForExport } from '@/features/rsvp/export';
import type { RsvpQuestion } from '@/features/rsvp/types';
import { toCsv, type CsvColumn } from '@/lib/csv';
import { requireEventAccess } from '@/server/authz';
import { isKnownError } from '@/server/authz/errors';
import {
  listRsvpQuestionsForEvent,
  listRsvpResponses,
  type ResponseRow,
} from '@/server/services/rsvp';

/**
 * Izvoz odgovora u CSV (zahtev 12).
 *
 * Kolone dodatnih pitanja se dodaju **dinamički**, po jedna za svako pitanje:
 * organizator hoće tabelu u kojoj su meniji i prevoz kolone koje može da
 * sortira, a ne jedno polje sa nabrajanjem.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  try {
    await requireEventAccess(eventId, 'rsvp:view');

    const [responses, questions] = await Promise.all([
      listRsvpResponses(eventId, { odgovor: 'svi', redosled: 'najnoviji' }),
      listRsvpQuestionsForEvent(eventId),
    ]);

    const csv = toCsv(responses, [...BASE_COLUMNS, ...questionColumns(questions)]);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="odgovori-${today}.csv"`,
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bez odgovora',
  yes: 'Dolazi',
  no: 'Ne dolazi',
  maybe: 'Možda',
};

const BASE_COLUMNS: Array<CsvColumn<ResponseRow>> = [
  { header: 'Ime i prezime', value: (row) => row.fullName },
  { header: 'Gost sa spiska', value: (row) => row.guestName },
  { header: 'Domaćinstvo', value: (row) => row.householdName },
  { header: 'Email', value: (row) => row.email },
  { header: 'Telefon', value: (row) => row.phone },
  { header: 'Odgovor', value: (row) => STATUS_LABELS[row.status] ?? row.status },
  { header: 'Odraslih', value: (row) => row.adultsCount },
  { header: 'Dece', value: (row) => row.childrenCount },
  { header: 'Pratnja', value: (row) => row.companions.join(', ') },
  { header: 'Poruka', value: (row) => row.message },
  { header: 'Poslato', value: (row) => row.submittedAt.toISOString() },
];

function questionColumns(
  questions: readonly RsvpQuestion[],
): Array<CsvColumn<ResponseRow>> {
  return questions.map((question) => ({
    header: question.label,
    value: (row: ResponseRow) => {
      const value = row.answers[question.id];
      return value === undefined ? '' : formatAnswerForExport(question, value);
    },
  }));
}
