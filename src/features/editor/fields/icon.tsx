'use client';

import { SectionIcon } from '@/features/sections/renderers/shared';
import type { IconName } from '@/features/sections/shared-schemas';
import { cn } from '@/lib/utils';

/**
 * Izbor ikone iz zatvorenog skupa (zahtev 9).
 *
 * Korisnik bira, a ne kuca naziv: proizvoljan string bi značio da renderer mora
 * da se brani od nepoznate vrednosti pri svakom prikazu, a i pozivnica bi mogla
 * da završi sa praznim mestom tamo gde je očekivana ikona.
 */
const ICON_NAMES: readonly IconName[] = [
  'church',
  'home',
  'building',
  'restaurant',
  'cake',
  'rings',
  'camera',
  'music',
  'car',
  'bed',
  'gift',
  'heart',
  'star',
  'clock',
  'map-pin',
  'baby',
  'balloon',
  'utensils',
  'glass',
  'sparkles',
];

export function IconField({
  label,
  value,
  onChange,
  /** Prevedeni nazivi ikona za čitač ekrana. */
  iconLabel,
}: {
  label: string;
  value: IconName;
  onChange: (value: IconName) => void;
  iconLabel: (name: IconName) => string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={label}>
        {ICON_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={iconLabel(name)}
            title={iconLabel(name)}
            onClick={() => onChange(name)}
            className={cn(
              'inline-flex aspect-square items-center justify-center rounded-[var(--radius-xs)] border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              value === name
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <SectionIcon name={name} className="size-4" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export { ICON_NAMES };
