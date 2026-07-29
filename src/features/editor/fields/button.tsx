'use client';

import type { z } from 'zod';

import type { buttonSchema } from '@/features/sections/shared-schemas';

import { ChoiceField, SwitchField, TextField, type Choice } from './basic';

type ButtonValue = z.infer<typeof buttonSchema>;

/**
 * Dugme sa proverenim linkom (zahtev 9).
 *
 * Korisnik zadaje tekst, adresu i stil - ali ne i ponašanje. Adresa mora da
 * bude `http`/`https` (Zod to proverava i pri čuvanju), pa `javascript:` link
 * ne može da uđe u pozivnicu ni preko uređivača ni mimo njega.
 */
export function ButtonField({
  labels,
  styleOptions,
  value,
  onChange,
}: {
  labels: {
    enabled: string;
    label: string;
    url: string;
    style: string;
  };
  styleOptions: readonly Choice[];
  value: ButtonValue | null;
  onChange: (value: ButtonValue | null) => void;
}) {
  return (
    <div className="space-y-3">
      <SwitchField
        label={labels.enabled}
        checked={value !== null}
        onChange={(checked) =>
          onChange(checked ? { label: '', url: '', style: 'primary' } : null)
        }
      />

      {value ? (
        <div className="space-y-3">
          <TextField
            label={labels.label}
            value={value.label}
            maxLength={60}
            onChange={(label) => onChange({ ...value, label })}
          />
          <TextField
            label={labels.url}
            type="url"
            value={value.url}
            placeholder="https://"
            onChange={(url) => onChange({ ...value, url })}
          />
          <ChoiceField
            label={labels.style}
            value={value.style}
            options={styleOptions}
            onChange={(style) =>
              onChange({ ...value, style: style as ButtonValue['style'] })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
