import type { z } from 'zod';

import { rsvpLabels } from '@/features/rsvp/labels';
import { RsvpForm } from '@/features/rsvp/rsvp-form';
import { formatDate } from '@/i18n/format';

import type { rsvpSection } from '../definitions/interaction';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type RsvpData = z.infer<typeof rsvpSection.schema>;

/**
 * Potvrda dolaska.
 *
 * Dva stanja, jasno razdvojena:
 *
 * - `live` (prava objavljena pozivnica) prikazuje **radnu** formu, sa gostovim
 *   ranijim odgovorom ako ga ima i sa dodatnim pitanjima organizatora;
 * - `preview` (demo šablona, pregled u uređivaču) prikazuje isti izgled sa
 *   onemogućenim poljima i napomenom da se ništa ne šalje.
 *
 * Razdvajanje je namerno i doslovno: u demo prikazu ne postoji ni jedan put kroz
 * koji bi se odgovor upisao, pa se ne može desiti da neko pomisli da je poslao
 * potvrdu, a ona nije nigde zapisana (zahtev 39.9).
 */
export function RsvpRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<RsvpData>) {
  const labels = rsvpLabels(locale);

  const deadlineLabel = data.deadline
    ? formatDate(new Date(`${data.deadline}T12:00:00Z`), locale, {
        timeZone: event.timeZone,
        dateStyle: 'long',
      })
    : null;

  const closed =
    event.mode === 'live' && isDeadlinePassed(data.deadline, event.timeZone);

  return (
    <SectionShell
      id={`rsvp-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      center
    >
      {deadlineLabel && !closed ? (
        <p className="inv-rsvp__deadline">
          {labels.deadline(deadlineLabel)}
          {data.deadlineNote ? ` ${data.deadlineNote}` : null}
        </p>
      ) : null}

      {closed ? (
        <div className="inv-card inv-rsvp">
          <p>{labels.closed}</p>
        </div>
      ) : event.live ? (
        <RsvpForm live={event.live} settings={data} labels={labels} index={index} />
      ) : (
        <RsvpPreview data={data} labels={labels} index={index} />
      )}
    </SectionShell>
  );
}

/**
 * Rok se meri po kraju dana u vremenskoj zoni događaja - isto pravilo koje
 * primenjuje i server akcija (`actions/rsvp.ts`).
 */
function isDeadlinePassed(
  deadline: string | null,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return today > deadline;
}

/** Izgled forme bez ijedne mogućnosti slanja - samo za demo i pregled. */
function RsvpPreview({
  data,
  labels,
  index,
}: {
  data: RsvpData;
  labels: ReturnType<typeof rsvpLabels>;
  index: number;
}) {
  const choices = [
    { value: 'yes', label: labels.yes },
    { value: 'no', label: labels.no },
    ...(data.allowMaybe ? [{ value: 'maybe', label: labels.maybe }] : []),
  ];

  return (
    <div className="inv-card inv-rsvp">
      <fieldset disabled className="inv-rsvp__fields">
        <legend className="inv-rsvp__preview-note">{labels.previewNote}</legend>

        <div className="inv-field">
          <label htmlFor={`rsvp-ime-${index}`}>{labels.fullName}</label>
          <input
            id={`rsvp-ime-${index}`}
            name="fullName"
            type="text"
            autoComplete="name"
            className="inv-input"
          />
        </div>

        <div className="inv-field">
          <span className="inv-field__label">{labels.attending}</span>
          <div className="inv-choices">
            {choices.map((choice) => (
              <label key={choice.value} className="inv-choice">
                <input type="radio" name={`status-${index}`} value={choice.value} />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="inv-field-row">
          <div className="inv-field">
            <label htmlFor={`rsvp-odrasli-${index}`}>{labels.adults}</label>
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
              <label htmlFor={`rsvp-deca-${index}`}>{labels.children}</label>
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
            <label htmlFor={`rsvp-poruka-${index}`}>{labels.message}</label>
            <textarea
              id={`rsvp-poruka-${index}`}
              name="message"
              rows={3}
              className="inv-input"
            />
          </div>
        ) : null}

        <button type="submit" className="inv-button inv-rsvp__submit">
          {labels.submit}
        </button>
      </fieldset>
    </div>
  );
}
