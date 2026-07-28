'use client';

import { Heart } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { useFavorites } from './favorites-store';

/**
 * Prekidač „samo omiljeni".
 *
 * Favoriti žive u `localStorage`, pa server ne zna koji su - filtriranje mora
 * da se desi u pregledaču. Umesto da kartice postanu klijentske komponente
 * (i time dodaju JavaScript za svaku od njih), ovaj omotač samo sakriva
 * `<li data-template-slug>` elemente koji nisu omiljeni. Kartice ostaju
 * serverski renderovane.
 */
export function FavoritesGate({
  labels,
  filters,
  children,
}: {
  labels: { onlyFavorites: string; emptyFavorites: string };
  filters: ReactNode;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [hasHiddenAll, setHasHiddenAll] = useState(false);
  const favorites = useFavorites();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>('[data-template-slug]');
    let visible = 0;

    for (const item of items) {
      const slug = item.dataset.templateSlug ?? '';
      const show = !onlyFavorites || favorites.includes(slug);
      item.hidden = !show;
      if (show) visible += 1;
    }

    // Poruka o praznom izboru se prikazuje samo kada je filter aktivan i kada
    // je stvarno sve sakriveno.
    setHasHiddenAll(onlyFavorites && items.length > 0 && visible === 0);
  }, [onlyFavorites, favorites, children]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">{filters}</div>

        <button
          type="button"
          onClick={() => setOnlyFavorites((value) => !value)}
          aria-pressed={onlyFavorites}
          className={cn(
            'inline-flex h-12 items-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition-colors',
            onlyFavorites
              ? 'border-destructive/40 bg-destructive-subtle text-destructive'
              : 'border-border bg-surface text-foreground hover:bg-muted',
          )}
        >
          <Heart
            className="size-4"
            fill={onlyFavorites ? 'currentColor' : 'none'}
            aria-hidden
          />
          {labels.onlyFavorites}
          {favorites.length > 0 ? (
            <span className="text-xs text-muted-foreground">({favorites.length})</span>
          ) : null}
        </button>
      </div>

      <div ref={containerRef}>{children}</div>

      {hasHiddenAll ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {labels.emptyFavorites}
        </p>
      ) : null}
    </>
  );
}
