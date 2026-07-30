import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { PrintButton } from '@/features/seating/print-button';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import { getEventDetail } from '@/server/services/events';
import { getSeatingPlan } from '@/server/services/seating';

import './stampa.css';

/**
 * Prikaz rasporeda za štampu (zahtev 14.7).
 *
 * Ovo je i put do PDF-a. Pregledač iz ove stranice pravi PDF sa našim fontovima
 * i ispravnom dijakritikom (č, ć, š, ž, đ), što serverski generisan PDF sa
 * ugrađenim standardnim fontovima **ne** može - njihove tabele znakova nemaju
 * naša slova. Ime „Petrović" ispisano kao „Petrovi?" bilo bi gore od odsustva
 * dugmeta, pa je ovo svesna odluka, opisana i u README-u.
 *
 * Stranica je namerno bez interfejsa aplikacije: samo plan sale i spiskovi po
 * stolovima, sa prelomima strana koji ne cepaju sto na dve strane.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SeatingPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  await requireEventPageAccess(eventId, 'seating:view');

  const query = await searchParams;
  const requested = z.uuid().safeParse(
    Array.isArray(query.verzija) ? query.verzija[0] : query.verzija,
  );

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  const plan = await getSeatingPlan(
    eventId,
    requested.success ? requested.data : undefined,
  );

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const tableCount = plan.rooms.reduce((sum, room) => sum + room.tables.length, 0);
  const seatedCount = plan.rooms.reduce(
    (sum, room) =>
      sum + room.tables.reduce((inner, table) => inner + table.guests.length, 0),
    0,
  );

  return (
    <main className="stampa">
      <header className="stampa__zaglavlje">
        <h1>{t('seating.printTitle', { event: event.name })}</h1>
        <p className="stampa__opis">
          {t('seating.printSummary', { tables: tableCount, seated: seatedCount })}
          {plan.versionLabel ? ` · ${plan.versionLabel}` : ''}
        </p>
        <p className="stampa__uputstvo">{t('seating.printHint')}</p>
        <PrintButton label={t('seating.print')} />
      </header>

      {plan.rooms.map((room) => (
        <section key={room.id} className="stampa__sala">
          <h2>{room.name}</h2>

          {/*
            Plan sale kao SVG: vektor se štampa oštro na svakoj rezoluciji, a
            `viewBox` sam skalira salu na širinu strane.
          */}
          <svg
            className="stampa__platno"
            viewBox={`0 0 ${room.width} ${room.height}`}
            role="img"
            aria-label={room.name}
          >
            <rect
              x={0}
              y={0}
              width={room.width}
              height={room.height}
              fill="none"
              stroke="#999"
              strokeWidth={2}
              strokeDasharray="8 6"
            />

            {room.tables.map((table) => (
              <g
                key={table.id}
                transform={`translate(${table.x} ${table.y}) rotate(${table.rotation} ${table.width / 2} ${table.height / 2})`}
              >
                {table.shape === 'round' || table.shape === 'oval' ? (
                  <ellipse
                    cx={table.width / 2}
                    cy={table.height / 2}
                    rx={table.width / 2}
                    ry={table.height / 2}
                    fill="#fff"
                    stroke="#333"
                    strokeWidth={2}
                  />
                ) : (
                  <rect
                    width={table.width}
                    height={table.height}
                    rx={8}
                    fill="#fff"
                    stroke="#333"
                    strokeWidth={2}
                    strokeDasharray={table.shape === 'zone' ? '6 4' : undefined}
                  />
                )}

                <text
                  x={table.width / 2}
                  y={table.height / 2}
                  textAnchor="middle"
                  fontSize={16}
                  fill="#111"
                >
                  {table.name}
                </text>
                <text
                  x={table.width / 2}
                  y={table.height / 2 + 18}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#555"
                >
                  {t('seating.seatsUsed', {
                    seated: table.guests.length,
                    capacity: table.capacity,
                  })}
                </text>
              </g>
            ))}
          </svg>

          <div className="stampa__stolovi">
            {room.tables.map((table) => (
              <section key={table.id} className="stampa__sto">
                <h3>
                  {table.name}{' '}
                  <span className="stampa__mesta">
                    {t('seating.seatsUsed', {
                      seated: table.guests.length,
                      capacity: table.capacity,
                    })}
                  </span>
                </h3>

                {table.notes ? <p className="stampa__napomena">{table.notes}</p> : null}

                {table.guests.length === 0 ? (
                  <p className="stampa__prazno">{t('seating.printEmptyTable')}</p>
                ) : (
                  <ol className="stampa__gosti">
                    {table.guests.map((guest) => (
                      <li key={guest.assignmentId}>{guest.name}</li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </section>
      ))}

      {plan.unseated.length > 0 ? (
        <section className="stampa__sala">
          <h2>{t('seating.printUnseated')}</h2>
          <ul className="stampa__gosti stampa__gosti--kolone">
            {plan.unseated.map((guest) => (
              <li key={guest.id}>{guest.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
