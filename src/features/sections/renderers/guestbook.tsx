import type { z } from 'zod';

import { GuestbookForm } from '@/features/guestbook/guestbook-form';
import { fillLabel, guestbookLabels } from '@/features/rsvp/labels';
import { formatDate } from '@/i18n/format';

import type { guestbookSection } from '../definitions/interaction';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type GuestbookData = z.infer<typeof guestbookSection.schema>;

/**
 * Knjiga želja (zahtev 9).
 *
 * Na pravoj pozivnici forma radi i ispod nje stoje odobrene poruke. U demo
 * prikazu je ista forma onemogućena, sa napomenom da se ništa ne čuva.
 *
 * Poruke se ispisuju kao **tekst**: React ne izvršava ono što gost napiše, pa
 * ni poruka koja liči na HTML ne može ništa kod sledećeg posetioca (zahtev 24).
 */
export function GuestbookRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<GuestbookData>) {
  const labels = guestbookLabels(locale);
  const entries = event.live?.guestbookEntries ?? [];

  return (
    <SectionShell
      id={`knjiga-zelja-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      center
    >
      {event.live ? (
        <GuestbookForm
          live={event.live}
          labels={labels}
          maxMessageLength={data.maxMessageLength}
          requireApproval={data.requireApproval}
          allowReactions={data.allowReactions}
        />
      ) : (
        <GuestbookPreview data={data} labels={labels} index={index} />
      )}

      {data.showPublicly && event.live ? (
        <ul className="inv-wishes">
          {entries.length === 0 ? (
            <li className="inv-muted">{labels.empty}</li>
          ) : (
            entries.map((entry) => (
              <li key={entry.id} className="inv-wish">
                <p className="inv-wish__message">{entry.message}</p>
                <p className="inv-wish__author">
                  {entry.reaction ? (
                    <span aria-hidden className="inv-wish__reaction">
                      {entry.reaction}{' '}
                    </span>
                  ) : null}
                  {entry.authorName}
                  <span className="inv-muted">
                    {' · '}
                    {formatDate(new Date(entry.createdAt), locale, {
                      timeZone: event.timeZone,
                      dateStyle: 'medium',
                    })}
                  </span>
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </SectionShell>
  );
}

function GuestbookPreview({
  data,
  labels,
  index,
}: {
  data: GuestbookData;
  labels: ReturnType<typeof guestbookLabels>;
  index: number;
}) {
  return (
    <div className="inv-card inv-guestbook">
      <fieldset disabled className="inv-guestbook__fields">
        <legend className="inv-rsvp__preview-note">{labels.previewNote}</legend>

        <div className="inv-field">
          <label htmlFor={`zelje-ime-${index}`}>{labels.authorName}</label>
          <input
            id={`zelje-ime-${index}`}
            name="authorName"
            type="text"
            autoComplete="name"
            className="inv-input"
          />
        </div>

        <div className="inv-field">
          <label htmlFor={`zelje-poruka-${index}`}>{labels.message}</label>
          <textarea
            id={`zelje-poruka-${index}`}
            name="message"
            rows={4}
            maxLength={data.maxMessageLength}
            className="inv-input"
          />
          <p className="inv-field__hint inv-muted">
            {fillLabel(labels.charactersLeft, { count: data.maxMessageLength })}
          </p>
        </div>

        <button type="submit" className="inv-button">
          {labels.submit}
        </button>

        {data.requireApproval ? (
          <p className="inv-muted inv-guestbook__notice">{labels.thanksPending}</p>
        ) : null}
      </fieldset>
    </div>
  );
}
