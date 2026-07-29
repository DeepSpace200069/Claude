'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import type { RichText } from '@/features/sections/shared-schemas';
import { cn } from '@/lib/utils';

/**
 * Uređivanje bogatog teksta bez proizvoljnog HTML-a (zahtev 9).
 *
 * Korisnik ne kuca oznake i ne lepi HTML - bira vrstu bloka (pasus, naslov,
 * lista, citat) i unosi čist tekst. Zbog toga u trenutku prikaza nema šta da se
 * sanitizuje: renderer zna tačan skup blokova i sam pravi elemente.
 */
type Block = RichText['blocks'][number];
type BlockKind = Block['kind'];

export type RichTextLabels = {
  title: string;
  empty: string;
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  kinds: Record<BlockKind, string>;
  listItemPlaceholder: string;
  addListItem: string;
};

const KINDS: readonly BlockKind[] = ['paragraph', 'heading', 'list', 'quote'];

function createBlock(kind: BlockKind): Block {
  switch (kind) {
    case 'heading':
      return { kind: 'heading', level: 2, text: '' };
    case 'list':
      return { kind: 'list', ordered: false, items: [''] };
    case 'quote':
      return { kind: 'quote', text: '' };
    default:
      return { kind: 'paragraph', text: '' };
  }
}

export function RichTextField({
  value,
  onChange,
  labels,
  maxBlocks = 30,
}: {
  value: RichText;
  onChange: (value: RichText) => void;
  labels: RichTextLabels;
  maxBlocks?: number;
}) {
  const blocks = value.blocks;

  const update = (next: Block[]) => onChange({ blocks: next });

  const replaceAt = (index: number, block: Block) =>
    update(blocks.map((item, i) => (i === index ? block : item)));

  const moveBy = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    update(next);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{labels.title}</h3>

      {blocks.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <ol className="space-y-2">
          {blocks.map((block, index) => (
            <li
              key={index}
              className="rounded-[var(--radius)] border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {labels.kinds[block.kind]}
                </span>
                <div className="flex items-center gap-0.5">
                  <SmallAction
                    label={labels.moveUp}
                    disabled={index === 0}
                    onClick={() => moveBy(index, -1)}
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
                  </SmallAction>
                  <SmallAction
                    label={labels.moveDown}
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBy(index, 1)}
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </SmallAction>
                  <SmallAction
                    label={labels.remove}
                    onClick={() => update(blocks.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </SmallAction>
                </div>
              </div>

              <div className="p-2.5">
                <BlockEditor
                  block={block}
                  labels={labels}
                  onChange={(next) => replaceAt(index, next)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="secondary"
            size="sm"
            disabled={blocks.length >= maxBlocks}
            onClick={() => update([...blocks, createBlock(kind)])}
          >
            <Plus aria-hidden />
            {labels.kinds[kind]}
          </Button>
        ))}
      </div>
    </section>
  );
}

function BlockEditor({
  block,
  labels,
  onChange,
}: {
  block: Block;
  labels: RichTextLabels;
  onChange: (block: Block) => void;
}) {
  if (block.kind === 'list') {
    return (
      <div className="space-y-1.5">
        {block.items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={item}
              placeholder={labels.listItemPlaceholder}
              aria-label={`${labels.kinds.list} ${index + 1}`}
              onChange={(event) =>
                onChange({
                  ...block,
                  items: block.items.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                })
              }
            />
            <SmallAction
              label={labels.remove}
              onClick={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
            </SmallAction>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={block.items.length >= 20}
          onClick={() => onChange({ ...block, items: [...block.items, ''] })}
        >
          <Plus aria-hidden />
          {labels.addListItem}
        </Button>
      </div>
    );
  }

  if (block.kind === 'heading') {
    return (
      <Input
        value={block.text}
        aria-label={labels.kinds.heading}
        onChange={(event) => onChange({ ...block, text: event.target.value })}
      />
    );
  }

  return (
    <Textarea
      rows={3}
      value={block.text}
      aria-label={labels.kinds[block.kind]}
      onChange={(event) => onChange({ ...block, text: event.target.value })}
    />
  );
}

function SmallAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)]',
        'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:opacity-35',
      )}
    >
      {children}
    </button>
  );
}
