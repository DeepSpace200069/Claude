'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldContextValue = {
  controlId: string;
  hintId: string;
  errorId: string;
  hasError: boolean;
  hasHint: boolean;
  isRequired: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Pristupačno polje forme.
 *
 * Povezuje labelu, pomoćni tekst i poruku greške sa kontrolom preko
 * `aria-describedby` i `aria-invalid` (zahtev 31), tako da čitači ekrana
 * pročitaju grešku odmah uz polje.
 *
 * Zvezdica obaveznog polja stoji **pored** labele, a ne u njoj: unutar labele
 * bi ušla u naziv polja („Ime*”) svuda gde se naziv računa iz teksta, iako je
 * `aria-hidden`. Obaveznost se prenosi kroz `aria-required` na samoj kontroli,
 * što je i jedini oblik koji čitač ekrana zaista pročita.
 */
export function Field({
  label,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Tekst za oznaku „opciono” - dolazi iz prevoda. */
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const value: FieldContextValue = {
    controlId: `${id}-control`,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
    hasError: Boolean(error),
    hasHint: Boolean(hint),
    isRequired: Boolean(required),
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline">
            <Label htmlFor={value.controlId}>{label}</Label>
            {required ? (
              <span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            ) : null}
          </span>
          {!required && optionalLabel ? (
            <span className="text-xs text-muted-foreground">{optionalLabel}</span>
          ) : null}
        </div>

        {children}

        {hint ? (
          <p id={value.hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={value.errorId} className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * Vraća atribute koje kontrola treba da raširi na sebe.
 * Upotreba: `<Input {...useFieldControl()} name="city" />`
 */
export function useFieldControl(): {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
} {
  const context = useContext(FieldContext);

  if (!context) {
    throw new Error('useFieldControl mora biti korišćen unutar <Field>.');
  }

  const describedBy = [
    context.hasHint ? context.hintId : null,
    context.hasError ? context.errorId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: context.controlId,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(context.hasError ? { 'aria-invalid': true } : {}),
    ...(context.isRequired ? { 'aria-required': true } : {}),
  };
}

/** Kontrola koja sama preuzima atribute polja. */
export function FieldControl({
  children,
}: {
  children: (props: ReturnType<typeof useFieldControl>) => ReactNode;
}) {
  const controlProps = useFieldControl();
  return <>{children(controlProps)}</>;
}
