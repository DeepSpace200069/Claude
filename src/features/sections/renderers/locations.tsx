import { ExternalLink, Navigation } from 'lucide-react';
import type { z } from 'zod';

import { formatDate } from '@/i18n/format';
import { locationLabels } from '@/features/rsvp/labels';

import type { locationsSection } from '../definitions/logistics';
import type { SectionRendererProps } from '../types';
import { SectionIcon, SectionShell } from './shared';

type LocationsData = z.infer<typeof locationsSection.schema>;

/**
 * Lokacije.
 *
 * Navigacija se nudi kroz linkove koje je organizator uneo, a ako ih nema, kroz
 * koordinate. Namerno ne ugrađujemo iframe mape: to je treći kolačić i nekoliko
 * stotina kilobajta po lokaciji, na stranici koju gost otvara sa telefona.
 */
export function LocationsRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<LocationsData>) {
  if (data.locations.length === 0) return null;

  // Oznake idu iz tabele po jeziku, ne iz koda: pozivnica na engleskom ne sme
  // da prikaže srpski naziv polja.
  const labels = locationLabels(locale);

  return (
    <SectionShell
      id={`lokacije-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      wide={data.layout === 'cards' && data.locations.length > 1}
      center={data.layout !== 'list'}
    >
      <ul className={`inv-locations inv-locations--${data.layout}`}>
        {data.locations.map((location) => {
          const dateLabel = location.date
            ? formatDate(new Date(`${location.date}T12:00:00Z`), locale, {
                timeZone: event.timeZone,
                dateStyle: 'long',
              })
            : null;

          const mapsUrl =
            location.googleMapsUrl ??
            (location.coordinates
              ? `https://www.google.com/maps/search/?api=1&query=${location.coordinates.lat},${location.coordinates.lng}`
              : null);

          return (
            <li key={location.id} className="inv-card inv-location">
              <div className="inv-location__head">
                <span className="inv-location__icon" aria-hidden>
                  <SectionIcon name={location.icon} className="inv-icon" />
                </span>
                <div>
                  <h3>{location.name}</h3>
                  {location.address ? (
                    <p className="inv-muted inv-location__address">
                      {location.address}
                    </p>
                  ) : null}
                </div>
              </div>

              {dateLabel || location.time ? (
                <p className="inv-location__when">
                  {[dateLabel, location.time].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              {location.description ? <p>{location.description}</p> : null}

              {location.parkingNote || location.accessibilityNote ? (
                <dl className="inv-location__notes">
                  {location.parkingNote ? (
                    <div>
                      <dt>{labels.parking}</dt>
                      <dd>{location.parkingNote}</dd>
                    </div>
                  ) : null}
                  {location.accessibilityNote ? (
                    <div>
                      <dt>{labels.accessibility}</dt>
                      <dd>{location.accessibilityNote}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {location.contactPhone || location.contactEmail ? (
                <p className="inv-location__contact">
                  {location.contactPhone ? (
                    <a href={`tel:${location.contactPhone.replace(/\s/g, '')}`}>
                      {location.contactPhone}
                    </a>
                  ) : null}
                  {location.contactEmail ? (
                    <a href={`mailto:${location.contactEmail}`}>
                      {location.contactEmail}
                    </a>
                  ) : null}
                </p>
              ) : null}

              {mapsUrl || location.appleMapsUrl ? (
                <div className="inv-actions inv-actions--start">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      className="inv-button"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="inv-icon" aria-hidden />
                      Navigacija
                      <span className="sr-only">do lokacije {location.name}</span>
                    </a>
                  ) : null}
                  {location.appleMapsUrl ? (
                    <a
                      href={location.appleMapsUrl}
                      className="inv-button inv-button--secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="inv-icon" aria-hidden />
                      Apple Maps
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
