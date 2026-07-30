'use client';

import { useDraggable } from '@dnd-kit/core';
import { Baby, Accessibility, DoorOpen, GripVertical, ToyBrick } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PreferenceKind } from '@/server/services/seating';

/**
 * Gost kao pokretna pločica.
 *
 * Prevlačenje je prijatan način da se raspored složi mišem, ali **nikad jedini**:
 * uz svaku pločicu ide lista stolova kojom se ista radnja izvodi tastaturom
 * (zahtev 31). Zato ovde stoji samo hvatište za prevlačenje, a sama lista je
 * odvojena kontrola pored njega.
 */
export function GuestChip({
  guestId,
  name,
  isChild,
  needs,
  dragDisabled,
  children,
}: {
  guestId: string;
  name: string;
  isChild: boolean;
  needs: readonly PreferenceKind[];
  dragDisabled: boolean;
  /** Pristupačna alternativa prevlačenju (lista stolova). */
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `gost-${guestId}`,
    data: { type: 'guest', guestId },
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-1.5 rounded-[var(--radius)] border border-border bg-surface px-2 py-1 text-xs',
        isDragging && 'opacity-40',
      )}
    >
      {dragDisabled ? null : (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" aria-hidden />
          <span className="sr-only">{name}</span>
        </button>
      )}

      <span className="min-w-0 flex-1 truncate">{name}</span>

      {isChild ? (
        <ToyBrick className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}

      {needs.map((need) => (
        <NeedIcon key={need} kind={need} />
      ))}

      {children}
    </div>
  );
}

/**
 * Posebni zahtevi kao ikone.
 *
 * Ikone su `aria-hidden`, a značenje nose naslovi u panelu pravila - u pločici
 * širokoj pet centimetara nema mesta za rečenicu, ali organizator mora da vidi
 * da za tim stolom treba stolica za bebe.
 */
function NeedIcon({ kind }: { kind: PreferenceKind }) {
  const Icon =
    kind === 'high_chair'
      ? Baby
      : kind === 'accessible'
        ? Accessibility
        : kind === 'near_exit'
          ? DoorOpen
          : kind === 'kids_table'
            ? ToyBrick
            : null;

  if (!Icon) return null;
  return <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />;
}
