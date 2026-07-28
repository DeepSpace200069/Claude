'use client';

import { Heart } from 'lucide-react';

import { cn } from '@/lib/utils';

import { toggleFavorite, useFavorites } from './favorites-store';

/** Označavanje šablona kao omiljenog; stanje živi u `favorites-store`. */
export function FavoriteButton({
  templateSlug,
  labels,
}: {
  templateSlug: string;
  labels: { add: string; remove: string };
}) {
  const favorites = useFavorites();
  const isFavorite = favorites.includes(templateSlug);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(templateSlug)}
      // `z-10` drži dugme iznad linka koji pokriva celu karticu.
      className={cn(
        'relative z-10 flex size-9 items-center justify-center rounded-full',
        'bg-white/85 text-sand-700 shadow-soft backdrop-blur transition-colors',
        'hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isFavorite && 'text-destructive',
      )}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? labels.remove : labels.add}
    >
      <Heart className="size-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
