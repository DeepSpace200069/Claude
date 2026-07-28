'use client';

import { Check, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';

export type WizardTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  eventTypeKey: string;
  requiredPlanCode: string;
  background: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  border: string;
  isFeatured: boolean;
};

/**
 * Izbor šablona u čarobnjaku (zahtev 7, korak 3).
 *
 * Minijature koriste stvarne boje šablona umesto slika: nema dodatnih zahteva,
 * a ono što korisnik vidi je tačno ono što dobije. „Prazna pozivnica" je uvek
 * prva opcija - šablon je polazna tačka, ne obaveza (zahtev 1, korak 2).
 */
export function TemplatePicker({
  templates,
  value,
  onChange,
  labels,
}: {
  templates: WizardTemplate[];
  value: string | null;
  onChange: (templateId: string | null) => void;
  labels: {
    blank: string;
    blankDescription: string;
    featured: string;
    planPrefix: string;
    empty: string;
  };
}) {
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <TemplateOption
            selected={value === null}
            onSelect={() => onChange(null)}
            name={labels.blank}
            description={labels.blankDescription}
          />
        </li>

        {templates.map((template) => (
          <li key={template.id}>
            <TemplateOption
              selected={value === template.id}
              onSelect={() => onChange(template.id)}
              name={template.name}
              description={template.description}
              badge={
                template.requiredPlanCode !== 'free'
                  ? `${labels.planPrefix} ${template.requiredPlanCode}`
                  : template.isFeatured
                    ? labels.featured
                    : undefined
              }
              palette={template}
            />
          </li>
        ))}
      </ul>

      {templates.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}
    </div>
  );
}

function TemplateOption({
  selected,
  onSelect,
  name,
  description,
  badge,
  palette,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  description: string;
  badge?: string;
  palette?: Pick<
    WizardTemplate,
    'background' | 'text' | 'textMuted' | 'accent' | 'accentContrast' | 'border'
  >;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary ring-2 ring-ring/30'
          : 'border-border hover:border-primary/50',
      )}
    >
      <div
        className="relative flex aspect-[5/3] flex-col items-center justify-center gap-2 px-4 text-center"
        style={
          palette
            ? { backgroundColor: palette.background, color: palette.text }
            : undefined
        }
      >
        {palette ? (
          <>
            <span
              className="text-sm leading-tight"
              style={{ fontFamily: "'Iowan Old Style', Georgia, serif" }}
            >
              {name}
            </span>
            <span
              aria-hidden
              className="h-px w-8"
              style={{ backgroundColor: palette.border }}
            />
            <span
              className="rounded-full px-3 py-1 text-[0.625rem] font-semibold"
              style={{
                backgroundColor: palette.accent,
                color: palette.accentContrast,
              }}
            >
              RSVP
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileText className="size-6" aria-hidden />
            <span className="text-sm font-medium text-foreground">{name}</span>
          </span>
        )}

        {selected ? (
          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 bg-surface p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{name}</span>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium capitalize text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {description}
        </span>
      </div>
    </button>
  );
}
