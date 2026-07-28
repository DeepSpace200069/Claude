import type { z } from 'zod';

import { formatDate } from '@/i18n/format';

import type { rsvpSection } from '../definitions/interaction';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type RsvpData = z.infer<typeof rsvpSection.schema>;

/**
 * Potvrda dolaska.
 *
 * U `preview` režimu (demo šablona, pregled u uređivaču) prikazuje se izgled
 * forme sa onemogućenim poljima i jasnom napomenom - demo ne sme da ostavlja
 * utisak da je odgovor poslat. Prava forma dolazi u Fazi 5 i renderuje se samo
 * u `live` režimu.
 */
export function RsvpRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<RsvpData>) {
  const deadlineLabel = data.deadline
    ? formatDate(new Date(`${data.deadline}T12:00:00Z`), locale, {
        timeZone: event.timeZone,
        dateStyle: 'long',
      })
    : null;

  const isPreview = event.mode === 'preview';

  return (
    <SectionShell
      id={`rsvp-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      center
    >
      {deadlineLabel ? (
        <p className="inv-rsvp__deadline">
          Molimo vas da odgovorite do <strong>{deadlineLabel}</strong>.
          {data.deadlineNote ? ` ${data.deadlineNote}` : null}
        </p>
      ) : null}

      <div className="inv-card inv-rsvp">
        <fieldset disabled={isPreview} className="inv-rsvp__fields">
          {isPreview ? (
            <legend className="inv-rsvp__preview-note">
              Ovako gost vidi formu. U demo prikazu odgovor se ne šalje.
            </legend>
          ) : (
            <legend className="sr-only">Potvrda dolaska</legend>
          )}

          <div className="inv-field">
            <label htmlFor={`rsvp-ime-${index}`}>Ime i prezime</label>
            <input
              id={`rsvp-ime-${index}`}
              name="fullName"
              type="text"
              autoComplete="name"
              className="inv-input"
            />
          </div>

          <div className="inv-field">
            <span className="inv-field__label">Dolazite li?</span>
            <div className="inv-choices">
              {[
                { value: 'yes', label: 'Dolazim' },
                { value: 'no', label: 'Ne dolazim' },
                ...(data.allowMaybe
                  ? [{ value: 'maybe', label: 'Još nisam siguran' }]
                  : []),
              ].map((choice) => (
                <label key={choice.value} className="inv-choice">
                  <input type="radio" name={`status-${index}`} value={choice.value} />
                  <span>{choice.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="inv-field-row">
            <div className="inv-field">
              <label htmlFor={`rsvp-odrasli-${index}`}>Broj odraslih</label>
              <input
                id={`rsvp-odrasli-${index}`}
                name="adultsCount"
                type="number"
                min={0}
                max={20}
                defaultValue={1}
                className="inv-input"
              />
            </div>

            {data.askChildren ? (
              <div className="inv-field">
                <label htmlFor={`rsvp-deca-${index}`}>Broj dece</label>
                <input
                  id={`rsvp-deca-${index}`}
                  name="childrenCount"
                  type="number"
                  min={0}
                  max={20}
                  defaultValue={0}
                  className="inv-input"
                />
              </div>
            ) : null}
          </div>

          {data.askMessage ? (
            <div className="inv-field">
              <label htmlFor={`rsvp-poruka-${index}`}>Poruka domaćinima</label>
              <textarea
                id={`rsvp-poruka-${index}`}
                name="message"
                rows={3}
                className="inv-input"
              />
            </div>
          ) : null}

          <button type="submit" className="inv-button inv-rsvp__submit">
            Pošalji odgovor
          </button>
        </fieldset>
      </div>
    </SectionShell>
  );
}
