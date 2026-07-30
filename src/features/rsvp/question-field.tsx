'use client';

import { useId } from 'react';

import type { RsvpLabels } from './labels';
import type { RsvpAnswerValue, RsvpQuestion } from './types';

/**
 * Jedno dodatno pitanje organizatora (zahtev 12).
 *
 * Svih šest tipova ima svoje polje - `single_choice` nije padajuća lista sa
 * jednom opcijom nego stvarni izbor, a `multi_choice` stvarne kućice. Tako gost
 * na telefonu vidi šta bira bez otvaranja dodatnih menija.
 */
export function QuestionField({
  question,
  labels,
  value,
  error,
  onChange,
}: {
  question: RsvpQuestion;
  labels: RsvpLabels;
  value: RsvpAnswerValue | undefined;
  error: string | undefined;
  onChange: (value: RsvpAnswerValue | undefined) => void;
}) {
  const id = useId();
  const describedBy = [
    question.helpText ? `${id}-pomoc` : null,
    error ? `${id}-greska` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const help = (
    <>
      {question.helpText ? (
        <p className="inv-field__hint" id={`${id}-pomoc`}>
          {question.helpText}
        </p>
      ) : null}
      {error ? (
        <p className="inv-field__hint" id={`${id}-greska`} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  if (question.type === 'single_choice' || question.type === 'multi_choice') {
    const multiple = question.type === 'multi_choice';
    const selected = multiple
      ? Array.isArray(value)
        ? value
        : []
      : typeof value === 'string'
        ? [value]
        : [];

    return (
      <div className="inv-field">
        <span className="inv-field__label" id={`${id}-naslov`}>
          {question.label}
          {question.isRequired ? <span aria-hidden> *</span> : null}
        </span>
        <p className="inv-field__hint">
          {multiple ? labels.chooseMany : labels.chooseOne}
        </p>

        <div
          className="inv-choices"
          role={multiple ? 'group' : 'radiogroup'}
          aria-labelledby={`${id}-naslov`}
          aria-describedby={describedBy || undefined}
        >
          {(question.config.options ?? []).map((option) => (
            <label key={option.value} className="inv-choice">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`${id}-opcije`}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={(event) => {
                  if (!multiple) {
                    onChange(option.value);
                    return;
                  }
                  const next = event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((current) => current !== option.value);
                  onChange(next.length > 0 ? next : undefined);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {help}
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <div className="inv-field">
        <label className="inv-choice" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            aria-describedby={describedBy || undefined}
            onChange={(event) => onChange(event.target.checked ? true : undefined)}
          />
          <span>
            {question.label}
            {question.isRequired ? <span aria-hidden> *</span> : null}
          </span>
        </label>
        {help}
      </div>
    );
  }

  const common = {
    id,
    className: 'inv-input',
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? (true as const) : undefined,
  };

  return (
    <div className="inv-field">
      <label htmlFor={id}>
        {question.label}
        {question.isRequired ? <span aria-hidden> *</span> : null}
      </label>

      {question.type === 'number' ? (
        <input
          {...common}
          type="number"
          inputMode="numeric"
          min={question.config.min ?? 0}
          max={question.config.max ?? 999}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      ) : question.type === 'date' ? (
        <input
          {...common}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      ) : (
        <textarea
          {...common}
          rows={2}
          maxLength={question.config.maxLength ?? 500}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      )}

      {help}
    </div>
  );
}
