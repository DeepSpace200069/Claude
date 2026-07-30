'use client';

import { useId, useState, useTransition } from 'react';

import { fillLabel, type GuestbookLabels } from '@/features/rsvp/labels';
import type { LiveInteractionContext } from '@/features/rsvp/types';

import { GUESTBOOK_REACTIONS } from './schemas';

/**
 * Forma knjige želja (zahtev 9).
 *
 * Poruka je čist tekst i takva se i ispisuje - bez ijedne mogućnosti da gost
 * ubaci oznaku koja bi se izvršila kod drugog gosta (zahtev 24).
 *
 * Kada je moderacija uključena, to se kaže **pre** slanja, a ne posle: gost koji
 * je napisao poruku i ne vidi je odmah pomisli da nešto nije radilo.
 */
export function GuestbookForm({
  live,
  labels,
  maxMessageLength,
  requireApproval,
  allowReactions,
}: {
  live: LiveInteractionContext;
  labels: GuestbookLabels;
  maxMessageLength: number;
  requireApproval: boolean;
  allowReactions: boolean;
}) {
  const fieldId = useId();
  const [pending, startTransition] = useTransition();

  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [reaction, setReaction] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<'pending' | 'approved' | null>(null);

  if (sent) {
    return (
      <div className="inv-card inv-guestbook" role="status" aria-live="polite">
        <p>{sent === 'approved' ? labels.thanksApproved : labels.thanksPending}</p>
      </div>
    );
  }

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    startTransition(async () => {
      const result = await live.submitGuestbookEntry({
        slug: live.slug,
        authorName,
        message,
        reaction,
        nonce: live.formNonce,
        companyName: honeypot,
      });

      if (result.ok) {
        setSent(result.data.status);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(result.message || labels.errorGeneric);
    });
  };

  const remaining = maxMessageLength - message.length;

  return (
    <form className="inv-card inv-guestbook" onSubmit={submit} noValidate>
      <fieldset className="inv-guestbook__fields" disabled={pending}>
        <legend className="sr-only">{labels.legend}</legend>

        <div className="inv-field">
          <label htmlFor={`${fieldId}-ime`}>{labels.authorName}</label>
          <input
            id={`${fieldId}-ime`}
            className="inv-input"
            type="text"
            autoComplete="name"
            required
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            aria-invalid={errors.authorName ? true : undefined}
          />
          {errors.authorName ? (
            <p className="inv-field__hint" role="alert">
              {errors.authorName[0]}
            </p>
          ) : null}
        </div>

        <div className="inv-field">
          <label htmlFor={`${fieldId}-poruka`}>{labels.message}</label>
          <textarea
            id={`${fieldId}-poruka`}
            className="inv-input"
            rows={4}
            required
            maxLength={maxMessageLength}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-describedby={`${fieldId}-preostalo`}
            aria-invalid={errors.message ? true : undefined}
          />
          <p className="inv-field__hint inv-muted" id={`${fieldId}-preostalo`}>
            {fillLabel(labels.charactersLeft, { count: remaining })}
          </p>
          {errors.message ? (
            <p className="inv-field__hint" role="alert">
              {errors.message[0]}
            </p>
          ) : null}
        </div>

        {allowReactions ? (
          <div className="inv-field">
            <span className="inv-field__label" id={`${fieldId}-reakcija`}>
              {labels.reaction}
            </span>
            <div
              className="inv-choices"
              role="radiogroup"
              aria-labelledby={`${fieldId}-reakcija`}
            >
              <label className="inv-choice">
                <input
                  type="radio"
                  name={`${fieldId}-reakcija-izbor`}
                  value=""
                  checked={reaction === ''}
                  onChange={() => setReaction('')}
                />
                <span>{labels.noReaction}</span>
              </label>

              {GUESTBOOK_REACTIONS.map((emoji) => (
                <label key={emoji} className="inv-choice">
                  <input
                    type="radio"
                    name={`${fieldId}-reakcija-izbor`}
                    value={emoji}
                    checked={reaction === emoji}
                    onChange={() => setReaction(emoji)}
                  />
                  <span aria-hidden>{emoji}</span>
                  <span className="sr-only">{emoji}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {/* Polje-mamac; vidi objašnjenje u RSVP formi. */}
        <input
          type="text"
          name="companyName"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: 'none' }}
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />

        <button type="submit" className="inv-button">
          {pending ? labels.submitting : labels.submit}
        </button>

        {requireApproval ? (
          <p className="inv-muted inv-guestbook__notice">{labels.thanksPending}</p>
        ) : null}

        <p aria-live="polite" className="inv-field__hint">
          {formError}
        </p>
      </fieldset>
    </form>
  );
}
