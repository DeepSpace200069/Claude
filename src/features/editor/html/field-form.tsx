'use client';

import { useId } from 'react';

import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  groupedFields,
  localized,
  type HtmlField,
} from '@/features/templates/html-schema';
import { isUploadedPhoto, type ValueResolution } from '@/features/templates/html-values';
import { useLocale, useTranslations } from '@/i18n/client';

import { ImageField } from './image-field';
import { useFieldEditorDispatch, useFieldEditorState } from './store';

/**
 * Forma polja uvezenog šablona (zahtev 39.4).
 *
 * Organizator ovde ne bira raspored - raspored je autorov i ne menja se. Bira
 * **sadržaj**, i to onaj koji je autor šablona označio kao promenljiv. Zato je
 * forma obična: grupe iz šablona, polja u redosledu iz šablona, bez biblioteke
 * sekcija i bez prevlačenja.
 *
 * Natpisi polja dolaze iz samog šablona i prevedeni su na jezike koje je autor
 * dao, sa padom na srpsku latinicu. Tekst interfejsa oko njih ide kroz katalog
 * prevoda, kao i svuda.
 */
export function FieldForm({ resolution }: { resolution: ValueResolution }) {
  const t = useTranslations();
  const locale = useLocale();
  const state = useFieldEditorState();
  const groups = groupedFields(state.definitions);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('editor.html.noFields')}</p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ group, fields }) => (
        <section key={group.key} className="space-y-3">
          <h3 className="text-sm font-semibold">{localized(group.label, locale)}</h3>

          <div className="space-y-4">
            {fields.map((field) => (
              <FieldControl key={field.key} field={field} resolution={resolution} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  resolution,
}: {
  field: HtmlField;
  resolution: ValueResolution;
}) {
  const locale = useLocale();
  const state = useFieldEditorState();
  const dispatch = useFieldEditorDispatch();
  const id = useId();

  const value = state.values[field.key] ?? '';
  const error = state.errors[field.key]?.[0];
  const label = localized(field.label, locale);
  const hint = field.help ? localized(field.help, locale) : undefined;

  const setValue = (next: string) =>
    dispatch({ kind: 'setValue', key: field.key, value: next });

  if (field.type === 'image') {
    return (
      <ImageField
        label={label}
        {...(hint ? { hint } : {})}
        value={value}
        defaultValue={field.default}
        preview={previewUrlFor(value, resolution)}
        {...(error ? { error } : {})}
        onChange={setValue}
      />
    );
  }

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {field.required ? (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        ) : null}
      </Label>

      {field.type === 'longtext' ? (
        <Textarea
          id={id}
          rows={4}
          value={value}
          required={field.required}
          {...(field.maxLength ? { maxLength: field.maxLength } : {})}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={inputTypeFor(field.type)}
          value={value}
          required={field.required}
          {...(field.maxLength ? { maxLength: field.maxLength } : {})}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      )}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tip HTML kontrole za tip polja.
 *
 * `place` je običan tekst: adresa se piše slobodno, a pregledačka provera formata
 * bi tu smetala više nego što bi pomogla.
 */
function inputTypeFor(type: HtmlField['type']): 'text' | 'date' | 'time' | 'url' {
  switch (type) {
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'url':
      return 'url';
    default:
      return 'text';
  }
}

function previewUrlFor(value: string, resolution: ValueResolution): string | null {
  if (value === '') return null;
  return isUploadedPhoto(value) ? resolution.mediaUrl(value) : resolution.assetUrl(value);
}
