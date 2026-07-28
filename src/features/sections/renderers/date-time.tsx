import type { z } from 'zod';

import { formatDate } from '@/i18n/format';

import type { dateTimeSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { Divider, eventDate, formatEventTime } from './shared';

type DateTimeData = z.infer<typeof dateTimeSection.schema>;

/**
 * Datum i vreme.
 *
 * Izvor istine je `events.starts_at`, ne sadržaj sekcije - kada organizator
 * pomeri datum događaja, izmena se odmah vidi na pozivnici, bez ponovnog
 * uređivanja sekcije (zahtev 38).
 */
export function DateTimeRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<DateTimeData>) {
  const date = eventDate(event);
  if (!date) return null;

  const time = data.showTime ? formatEventTime(event, locale) : null;
  const tz = { timeZone: event.timeZone };

  const dayName = data.showDayName
    ? formatDate(date, locale, { ...tz, weekday: 'long', dateStyle: undefined })
    : null;
  const dayNumber = formatDate(date, locale, { ...tz, day: 'numeric', dateStyle: undefined });
  const monthName = formatDate(date, locale, { ...tz, month: 'long', dateStyle: undefined });
  const year = formatDate(date, locale, { ...tz, year: 'numeric', dateStyle: undefined });

  const headingId = `datum-${index}`;

  if (data.display === 'stacked' || data.display === 'elegant') {
    return (
      <section
        className="inv-section inv-reveal"
        aria-labelledby={headingId}
        style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
      >
        <div className="inv-container inv-stack inv-center">
          {data.title ? <h2 id={headingId}>{data.title}</h2> : null}

          {/*
            Vizuelno je datum razložen na delove, ali čitač ekrana treba da čuje
            jedan pun datum - zato je `<time>` sa `aria-label` i skriveni delovi.
          */}
          <time
            dateTime={date.toISOString()}
            className={`inv-date inv-date--${data.display}`}
            aria-label={[dayName, dayNumber, monthName, year, time]
              .filter(Boolean)
              .join(' ')}
          >
            {dayName ? (
              <span className="inv-date__weekday" aria-hidden>
                {dayName}
              </span>
            ) : null}
            <span className="inv-date__row" aria-hidden>
              <span className="inv-date__day">{dayNumber}</span>
              <span className="inv-date__sep" />
              <span className="inv-date__month">{monthName}</span>
              <span className="inv-date__sep" />
              <span className="inv-date__year">{year}</span>
            </span>
            {time ? (
              <span className="inv-date__time" aria-hidden>
                {time}
              </span>
            ) : null}
          </time>

          {!data.title ? <span id={headingId} className="sr-only" /> : null}
          {data.note ? <p className="inv-muted">{data.note}</p> : null}
          <Divider />
        </div>
      </section>
    );
  }

  const full = formatDate(date, locale, { ...tz, dateStyle: 'full' });

  return (
    <section
      className="inv-section inv-reveal"
      aria-labelledby={headingId}
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="inv-container inv-stack inv-center">
        {data.title ? <h2 id={headingId}>{data.title}</h2> : null}
        <time dateTime={date.toISOString()} className="inv-date inv-date--full">
          {full}
          {time ? <span className="inv-date__time">{time}</span> : null}
        </time>
        {!data.title ? <span id={headingId} className="sr-only" /> : null}
        {data.note ? <p className="inv-muted">{data.note}</p> : null}
      </div>
    </section>
  );
}
