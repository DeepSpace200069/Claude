import { ArrowRight, Images, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { FavoriteButton } from '@/features/templates/favorite-button';
import { Badge } from '@/components/ui/badge';
import type { TemplateSummary } from '@/server/services/templates';
import { cn } from '@/lib/utils';

/**
 * Kartica šablona u galeriji.
 *
 * Umesto slike pregleda prikazuje **stvarne boje i tipografiju** šablona:
 * minijatura je izgrađena iz istih tokena teme kojima se renderuje pozivnica,
 * pa ne može da se razmimoiđe sa onim što korisnik dobije (zahtev 7).
 */
export function TemplateCard({
  template,
  labels,
  className,
}: {
  template: TemplateSummary;
  labels: {
    preview: string;
    featured: string;
    withPhotos: string;
    typeLabel: string;
    planLabel: string | null;
    favoriteAdd: string;
    favoriteRemove: string;
  };
  className?: string;
}) {
  const tokens = template.themeTokens;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lifted',
        className,
      )}
    >
      {/* Minijatura: pravi tokeni teme, bez slike i bez dodatnog zahteva. */}
      <div
        className="relative flex aspect-[4/5] flex-col items-center justify-center gap-3 px-6 text-center"
        style={{
          backgroundColor: tokens.palette.background,
          color: tokens.palette.text,
        }}
      >
        <span
          className="text-[0.6875rem] uppercase tracking-[0.18em]"
          style={{ color: tokens.palette.textMuted }}
        >
          {labels.typeLabel}
        </span>

        <span
          className="text-2xl leading-tight"
          style={{ fontFamily: previewFont(tokens.fontPair) }}
        >
          {template.name}
        </span>

        <span
          aria-hidden
          className="h-px w-12"
          style={{ backgroundColor: tokens.palette.border }}
        />

        <span
          className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: tokens.palette.accent,
            color: tokens.palette.accentContrast,
          }}
        >
          {labels.preview}
        </span>

        <div className="absolute left-3 top-3 flex gap-1.5">
          {template.isFeatured ? (
            <Badge variant="primary">
              <Sparkles className="size-3" aria-hidden />
              {labels.featured}
            </Badge>
          ) : null}
          {template.usesPhotos ? (
            <Badge variant="outline">
              <Images className="size-3" aria-hidden />
              {labels.withPhotos}
            </Badge>
          ) : null}
        </div>

        <div className="absolute right-3 top-3">
          <FavoriteButton
            templateSlug={template.slug}
            labels={{ add: labels.favoriteAdd, remove: labels.favoriteRemove }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug">
            {/*
              Link pokriva celu karticu preko `::after`, ali dugme za favorite
              ostaje iznad njega (`z-10`) da bi i dalje bilo klikabilno.
            */}
            <Link
              href={`/sabloni/${template.eventTypeSlug}/${template.slug}`}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {template.name}
            </Link>
          </h3>
          {labels.planLabel ? (
            <Badge variant="neutral">{labels.planLabel}</Badge>
          ) : null}
        </div>

        <p className="line-clamp-3 text-sm text-muted-foreground">
          {template.description}
        </p>

        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm text-primary">
          {labels.preview}
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </article>
  );
}

/** Font za minijaturu; puni stekovi žive u `features/themes/css.ts`. */
function previewFont(pair: TemplateSummary['themeTokens']['fontPair']): string {
  switch (pair) {
    case 'sans-modern':
    case 'sans-geometric':
      return "ui-sans-serif, system-ui, sans-serif";
    case 'display-playful':
      return "ui-rounded, 'SF Pro Rounded', ui-sans-serif, sans-serif";
    default:
      return "'Iowan Old Style', Georgia, serif";
  }
}
