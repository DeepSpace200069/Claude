'use client';

import { useId, useState, useTransition } from 'react';

import { QuestionField } from './question-field';
import type { RsvpLabels } from './labels';
import type { RsvpSectionData } from './section-data';
import type { LiveInteractionContext, RsvpAnswerValue } from './types';

/**
 * Prava RSVP forma (zahtev 12).
 *
 * Jedina klijentska komponenta na javnoj pozivnici koja nešto šalje. Napisana je
 * bez biblioteke za forme namerno: gost je najčešće na telefonu i na mobilnom
 * internetu, pa svaki kilobajt ovde košta više nego u aplikaciji organizatora
 * (zahtev 32 i 39.10).
 *
 * Provera ovde služi samo brzoj poruci. Odluku donosi server akcija, koja
 * ponovo proverava rok, pristup i sva polja (zahtev 24).
 */
export function RsvpForm({
  live,
  settings,
  labels,
  index,
}: {
  live: LiveInteractionContext;
  settings: RsvpSectionData;
  labels: RsvpLabels;
  index: number;
}) {
  const existing = live.existingResponse;
  const fieldId = useId();
  const [pending, startTransition] = useTransition();

  const [status, setStatus] = useState<'yes' | 'no' | 'maybe' | ''>(
    existing && existing.status !== 'pending' ? existing.status : '',
  );
  const [fullName, setFullName] = useState(existing?.fullName ?? live.greetingName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [adults, setAdults] = useState(String(existing?.adultsCount ?? 1));
  const [children, setChildren] = useState(String(existing?.childrenCount ?? 0));
  const [companions, setCompanions] = useState<string[]>(existing?.companions ?? []);
  const [message, setMessage] = useState(existing?.message ?? '');
  const [answers, setAnswers] = useState<Record<string, RsvpAnswerValue | undefined>>(
    existing?.answers ?? {},
  );
  const [honeypot, setHoneypot] = useState('');

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    status: 'yes' | 'no' | 'maybe';
    isUpdate: boolean;
    editUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const attending = status === 'yes';

  const questions = live.questions.filter(
    (question) => !question.attendingOnly || attending,
  );

  if (done) {
    return (
      <RsvpConfirmation
        result={done}
        labels={labels}
        confirmationMessage={settings.confirmationMessage}
        copied={copied}
        onCopy={() => {
          if (!done.editUrl) return;
          void navigator.clipboard
            .writeText(done.editUrl)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
        onEditAgain={() => {
          setDone(null);
          setCopied(false);
        }}
      />
    );
  }

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setFormError(null);

    if (status === '') {
      setErrors({ status: [labels.attending] });
      return;
    }

    setErrors({});

    startTransition(async () => {
      const result = await live.submitRsvp({
        slug: live.slug,
        token: live.recipientToken ?? '',
        editToken: live.editToken ?? '',
        fullName,
        email,
        phone,
        status,
        adultsCount: attending ? Number(adults) || 0 : 0,
        childrenCount: attending ? Number(children) || 0 : 0,
        companions: attending ? companions.filter((name) => name.trim() !== '') : [],
        message,
        answers,
        nonce: live.formNonce,
        companyName: honeypot,
      });

      if (result.ok) {
        setDone(result.data);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(result.message || labels.errorGeneric);
    });
  };

  const error = (name: string): string | undefined => errors[name]?.[0];

  return (
    <form className="inv-card inv-rsvp" onSubmit={submit} noValidate>
      <fieldset className="inv-rsvp__fields" disabled={pending}>
        <legend className="sr-only">{labels.legend}</legend>

        {live.maxGuests !== null ? (
          <p className="inv-field__hint">{labels.maxGuests(live.maxGuests)}</p>
        ) : null}

        <Field
          id={`${fieldId}-ime`}
          label={labels.fullName}
          error={error('fullName')}
          required
        >
          <input
            id={`${fieldId}-ime`}
            className="inv-input"
            type="text"
            autoComplete="name"
            value={fullName}
            required
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={error('fullName') ? true : undefined}
            aria-describedby={error('fullName') ? `${fieldId}-ime-greska` : undefined}
          />
        </Field>

        <div className="inv-field">
          <span className="inv-field__label" id={`${fieldId}-dolazak`}>
            {labels.attending}
          </span>
          <div
            className="inv-choices"
            role="radiogroup"
            aria-labelledby={`${fieldId}-dolazak`}
          >
            {statusChoices(settings.allowMaybe, labels).map((choice) => (
              <label key={choice.value} className="inv-choice">
                <input
                  type="radio"
                  name={`status-${index}`}
                  value={choice.value}
                  checked={status === choice.value}
                  onChange={() => setStatus(choice.value)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
          {error('status') ? (
            <p className="inv-field__hint" role="alert">
              {error('status')}
            </p>
          ) : null}
        </div>

        {attending ? (
          <div className="inv-field-row">
            <Field
              id={`${fieldId}-odrasli`}
              label={labels.adults}
              error={error('adultsCount')}
            >
              <input
                id={`${fieldId}-odrasli`}
                className="inv-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                value={adults}
                onChange={(event) => setAdults(event.target.value)}
              />
            </Field>

            {settings.askChildren ? (
              <Field
                id={`${fieldId}-deca`}
                label={labels.children}
                error={error('childrenCount')}
              >
                <input
                  id={`${fieldId}-deca`}
                  className="inv-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  value={children}
                  onChange={(event) => setChildren(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {attending && settings.askCompanionNames ? (
          <CompanionFields
            fieldId={fieldId}
            labels={labels}
            companions={companions}
            onChange={setCompanions}
          />
        ) : null}

        {settings.askContact ? (
          <>
            <Field id={`${fieldId}-email`} label={labels.email} error={error('email')}>
              <input
                id={`${fieldId}-email`}
                className="inv-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field id={`${fieldId}-telefon`} label={labels.phone} error={error('phone')}>
              <input
                id={`${fieldId}-telefon`}
                className="inv-input"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>

            <p className="inv-field__hint">{labels.contactHelp}</p>
          </>
        ) : null}

        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            labels={labels}
            value={answers[question.id]}
            error={error(`answers.${question.id}`)}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [question.id]: value }))
            }
          />
        ))}

        {settings.askMessage ? (
          <Field
            id={`${fieldId}-poruka`}
            label={labels.message}
            error={error('message')}
          >
            <textarea
              id={`${fieldId}-poruka`}
              className="inv-input"
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Field>
        ) : null}

        {/*
          Polje-mamac. Sakriveno je i van redosleda tabulatora, pa ga ni gost ni
          čitač ekrana ne sreću - popuni ga samo automat koji čita HTML.
        */}
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

        <button type="submit" className="inv-button inv-rsvp__submit">
          {pending
            ? labels.submitting
            : existing
              ? labels.update
              : labels.submit}
        </button>

        <p aria-live="polite" className="inv-field__hint">
          {formError}
        </p>
      </fieldset>
    </form>
  );
}

type StatusChoice = { value: 'yes' | 'no' | 'maybe'; label: string };

/** „Još nisam siguran" postoji samo ako ga je organizator ostavio uključenog. */
function statusChoices(allowMaybe: boolean, labels: RsvpLabels): StatusChoice[] {
  const choices: StatusChoice[] = [
    { value: 'yes', label: labels.yes },
    { value: 'no', label: labels.no },
  ];
  if (allowMaybe) choices.push({ value: 'maybe', label: labels.maybe });
  return choices;
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="inv-field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="inv-field__hint" id={`${id}-greska`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Imena osoba koje dolaze sa gostom.
 *
 * Red se dodaje dugmetom, a ne unapred određenim brojem polja: domaćin ne zna
 * koliko ko vodi, a prazna polja bi izgledala kao obaveza.
 */
function CompanionFields({
  fieldId,
  labels,
  companions,
  onChange,
}: {
  fieldId: string;
  labels: RsvpLabels;
  companions: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="inv-field">
      <span className="inv-field__label">{labels.companions}</span>
      <p className="inv-field__hint">{labels.companionsHelp}</p>

      {companions.map((name, position) => (
        <div key={`${fieldId}-pratnja-${position}`} className="inv-field-row">
          <input
            className="inv-input"
            type="text"
            value={name}
            aria-label={`${labels.companions} ${position + 1}`}
            onChange={(event) =>
              onChange(
                companions.map((current, index) =>
                  index === position ? event.target.value : current,
                ),
              )
            }
          />
          <button
            type="button"
            className="inv-button inv-button--secondary"
            onClick={() =>
              onChange(companions.filter((_, index) => index !== position))
            }
          >
            {labels.removeCompanion}
          </button>
        </div>
      ))}

      <button
        type="button"
        className="inv-button inv-button--secondary"
        onClick={() => onChange([...companions, ''])}
      >
        {labels.addCompanion}
      </button>
    </div>
  );
}

function RsvpConfirmation({
  result,
  labels,
  confirmationMessage,
  copied,
  onCopy,
  onEditAgain,
}: {
  result: { status: 'yes' | 'no' | 'maybe'; isUpdate: boolean; editUrl: string | null };
  labels: RsvpLabels;
  confirmationMessage: string;
  copied: boolean;
  onCopy: () => void;
  onEditAgain: () => void;
}) {
  const thanks = result.isUpdate
    ? labels.updated
    : result.status === 'yes'
      ? labels.thanksYes
      : result.status === 'no'
        ? labels.thanksNo
        : labels.thanksMaybe;

  return (
    <div className="inv-card inv-rsvp" role="status" aria-live="polite">
      <p className="inv-rsvp__thanks">{thanks}</p>

      {confirmationMessage ? <p>{confirmationMessage}</p> : null}

      {result.editUrl ? (
        <div className="inv-field">
          <p className="inv-field__hint">{labels.editHint}</p>
          <input
            className="inv-input"
            type="text"
            readOnly
            value={result.editUrl}
            aria-label={labels.editAgain}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="inv-button inv-button--secondary"
            onClick={onCopy}
          >
            {copied ? labels.copied : labels.copyLink}
          </button>
        </div>
      ) : null}

      <button type="button" className="inv-button inv-button--secondary" onClick={onEditAgain}>
        {labels.editAgain}
      </button>
    </div>
  );
}
