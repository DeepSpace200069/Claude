import { CalendarPlus } from 'lucide-react';
import type { z } from 'zod';

import type { calendarSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { SectionShell, eventDate } from './shared';

type CalendarData = z.infer<typeof calendarSection.schema>;

/** `YYYYMMDDTHHMMSSZ` - format koji traže i iCalendar i Google Calendar. */
function toCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Dodavanje u kalendar.
 *
 * `.ics` fajl se pravi kao `data:` URL umesto kroz serversku rutu: sadržaj je
 * poznat u trenutku renderovanja, pa nema razloga za dodatni zahtev, a
 * pozivnica ostaje upotrebljiva i kada je veza loša (zahtev 22).
 */
export function CalendarRenderer({
  data,
  event,
  index,
}: SectionRendererProps<CalendarData>) {
  const start = eventDate(event);
  if (!start) return null;

  // Bez zadatog kraja pretpostavljamo četiri sata - dovoljno za većinu proslava.
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const title = String(event.details.invitationTitle ?? event.venueName ?? '')
    .trim();
  const summary = title || 'Proslava';
  const location = [event.venueName, event.city].filter(Boolean).join(', ');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pozivnica//SR',
    'BEGIN:VEVENT',
    `DTSTART:${toCalendarStamp(start)}`,
    `DTEND:${toCalendarStamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    data.description ? `DESCRIPTION:${escapeIcs(data.description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    icsLines.join('\r\n'),
  )}`;

  const googleHref = new URL('https://calendar.google.com/calendar/render');
  googleHref.searchParams.set('action', 'TEMPLATE');
  googleHref.searchParams.set('text', summary);
  googleHref.searchParams.set(
    'dates',
    `${toCalendarStamp(start)}/${toCalendarStamp(end)}`,
  );
  if (location) googleHref.searchParams.set('location', location);
  if (data.description) googleHref.searchParams.set('details', data.description);

  const outlookHref = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlookHref.searchParams.set('path', '/calendar/action/compose');
  outlookHref.searchParams.set('subject', summary);
  outlookHref.searchParams.set('startdt', start.toISOString());
  outlookHref.searchParams.set('enddt', end.toISOString());
  if (location) outlookHref.searchParams.set('location', location);

  const links: Array<{ key: string; href: string; label: string }> = [
    { key: 'ics', href: icsHref, label: 'Kalendar (.ics)' },
    { key: 'google', href: googleHref.toString(), label: 'Google Calendar' },
    { key: 'outlook', href: outlookHref.toString(), label: 'Outlook' },
  ].filter((link) => data.providers.includes(link.key as 'ics' | 'google' | 'outlook'));

  return (
    <SectionShell
      id={`kalendar-${index}`}
      title={data.title}
      intro={data.description}
      index={index}
      center
    >
      <div className="inv-actions">
        {links.map((link) => (
          <a
            key={link.key}
            href={link.href}
            className="inv-button"
            {...(link.key === 'ics'
              ? { download: 'pozivnica.ics' }
              : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            <CalendarPlus className="inv-icon" aria-hidden />
            {link.label}
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

/** iCalendar traži escape-ovane zareze, tačka-zareze i nove redove. */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
