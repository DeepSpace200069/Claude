import type { z } from 'zod';

import type { guestbookSection } from '../definitions/interaction';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type GuestbookData = z.infer<typeof guestbookSection.schema>;

/**
 * Knjiga želja.
 *
 * Poruke se učitavaju i moderiraju u Fazi 5; ovde je izgled forme i, kada je
 * moderacija uključena, jasna napomena gostu da poruka ide na odobrenje - da ne
 * bi mislio da je nešto pošlo naopako kada je odmah ne vidi (zahtev 9).
 */
export function GuestbookRenderer({
  data,
  event,
  index,
}: SectionRendererProps<GuestbookData>) {
  const isPreview = event.mode === 'preview';

  return (
    <SectionShell
      id={`knjiga-zelja-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      center
    >
      <div className="inv-card inv-guestbook">
        <fieldset disabled={isPreview} className="inv-guestbook__fields">
          {isPreview ? (
            <legend className="inv-rsvp__preview-note">
              Ovako gost ostavlja poruku. U demo prikazu se ništa ne čuva.
            </legend>
          ) : (
            <legend className="sr-only">Ostavite poruku</legend>
          )}

          <div className="inv-field">
            <label htmlFor={`zelje-ime-${index}`}>Vaše ime</label>
            <input
              id={`zelje-ime-${index}`}
              name="authorName"
              type="text"
              autoComplete="name"
              className="inv-input"
            />
          </div>

          <div className="inv-field">
            <label htmlFor={`zelje-poruka-${index}`}>Poruka</label>
            <textarea
              id={`zelje-poruka-${index}`}
              name="message"
              rows={4}
              maxLength={data.maxMessageLength}
              className="inv-input"
            />
            <p className="inv-field__hint inv-muted">
              Najviše {data.maxMessageLength} znakova.
            </p>
          </div>

          <button type="submit" className="inv-button">
            Pošalji poruku
          </button>

          {data.requireApproval ? (
            <p className="inv-muted inv-guestbook__notice">
              Poruke se prikazuju nakon što ih domaćini pregledaju.
            </p>
          ) : null}
        </fieldset>
      </div>
    </SectionShell>
  );
}
