'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Move } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SeatingTable } from '@/server/services/seating';

/**
 * Sto na platnu sale.
 *
 * Oblik je pravi oblik, a ne ikona: okrugli sto je krug, mladenački je izdužen
 * pravougaonik. Organizator mora da prepozna svoju salu na ekranu, inače plan
 * nema svrhu.
 *
 * Pomeranje ide preko posebnog hvatišta, a ne po celoj površini. Bez toga bi
 * svaki pokušaj da se uhvati gost za stolom pomerio ceo sto.
 */
export function TableCard({
  table,
  x,
  y,
  zoom,
  isSelected,
  isOver,
  disabled,
  moveLabel,
  seatsLabel,
  onSelect,
  children,
}: {
  table: SeatingTable;
  x: number;
  y: number;
  zoom: number;
  isSelected: boolean;
  isOver: boolean;
  disabled: boolean;
  moveLabel: string;
  seatsLabel: string;
  onSelect: () => void;
  /** Pločice gostiju za ovim stolom. */
  children: React.ReactNode;
}) {
  /*
   * Vrednosti se raspakuju odmah, a ne čitaju kroz objekat pri renderu:
   * `useDraggable` vraća i `setNodeRef`, pa React Compiler pristup kroz objekat
   * tumači kao čitanje ref-a tokom rendera.
   */
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `sto-${table.id}`,
    data: { type: 'table', tableId: table.id },
    disabled,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: `mesto-${table.id}`,
    data: { type: 'table-slot', tableId: table.id },
    disabled,
  });

  const over = table.guests.length > table.capacity;

  const offset = transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };

  return (
    <div
      ref={setDragRef}
      className="absolute"
      style={{
        left: x * zoom,
        top: y * zoom,
        width: table.width * zoom,
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${table.rotation}deg)`,
        zIndex: isDragging ? 30 : isSelected ? 20 : 10,
      }}
    >
      <div
        ref={setDropRef}
        className={cn(
          'flex flex-col items-center border-2 bg-surface p-1.5 shadow-soft transition-colors',
          shapeClass(table.shape),
          isSelected ? 'border-primary' : 'border-border',
          isOver && 'border-primary bg-primary-subtle',
          over && 'border-destructive',
        )}
        style={{ minHeight: table.height * zoom }}
      >
        <div className="flex w-full items-center gap-1">
          {disabled ? null : (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted"
              {...dragAttributes}
              {...dragListeners}
            >
              <Move className="size-3.5" aria-hidden />
              <span className="sr-only">{moveLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 truncate text-left text-xs font-medium"
          >
            {table.name}
          </button>
        </div>

        <p
          className={cn(
            'w-full text-center text-[0.6875rem]',
            over ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {seatsLabel}
        </p>

        <div className="mt-1 flex w-full flex-col gap-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Oblik stola.
 *
 * `zone` je isprekidan okvir jer zona nije sto - to je prostor bez pojedinačnih
 * mesta (šank, plesni podijum) i ne sme da liči na sto za kojim se sedi.
 */
function shapeClass(shape: SeatingTable['shape']): string {
  switch (shape) {
    case 'round':
      return 'rounded-full';
    case 'oval':
      return 'rounded-[50%]';
    case 'head':
      return 'rounded-[var(--radius)]';
    case 'zone':
      return 'rounded-[var(--radius)] border-dashed bg-muted/40';
    case 'square':
    case 'rectangle':
    default:
      return 'rounded-[var(--radius-xs)]';
  }
}
