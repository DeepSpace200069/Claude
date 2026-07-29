'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Lista stavki koje se dodaju i uklanjaju (lokacije, satnica, kartice, osobe…).
 *
 * Redosled se menja dugmadima, a ne prevlačenjem: unutar inspektora su stavke
 * kratke i dugmad su brža i za miša i za tastaturu. Prevlačenje ima svoje mesto
 * na nivou sekcija, gde je razdaljina veća, i tamo ionako mora da postoji
 * alternativa bez miša (zahtev 31).
 */
export type ListFieldLabels = {
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  empty: string;
};

export function ListField<T>({
  label,
  items,
  labels,
  max,
  getKey,
  getTitle,
  createItem,
  onChange,
  renderItem,
}: {
  label: string;
  items: readonly T[];
  labels: ListFieldLabels;
  max?: number;
  getKey: (item: T, index: number) => string;
  getTitle: (item: T, index: number) => string;
  createItem: () => T;
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode;
}) {
  const groupId = useId();
  const canAdd = max === undefined || items.length < max;

  const replaceAt = (index: number, next: T) => {
    onChange(items.map((item, i) => (i === index ? next : item)));
  };

  const removeAt = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const moveBy = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <section className="space-y-2" aria-labelledby={groupId}>
      <h3 id={groupId} className="text-xs font-medium text-muted-foreground">
        {label}
      </h3>

      {items.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={getKey(item, index)}
              className="rounded-[var(--radius)] border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="truncate text-xs font-medium">
                  {getTitle(item, index)}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconAction
                    label={labels.moveUp}
                    disabled={index === 0}
                    onClick={() => moveBy(index, -1)}
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </IconAction>
                  <IconAction
                    label={labels.moveDown}
                    disabled={index === items.length - 1}
                    onClick={() => moveBy(index, 1)}
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </IconAction>
                  <IconAction
                    label={labels.remove}
                    destructive
                    onClick={() => removeAt(index)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconAction>
                </div>
              </div>

              <div className="space-y-3 p-3">
                {renderItem(item, (next) => replaceAt(index, next), index)}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={!canAdd}
        onClick={() => onChange([...items, createItem()])}
      >
        <Plus aria-hidden />
        {labels.add}
      </Button>
    </section>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-[var(--radius-xs)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:opacity-35',
        destructive
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
