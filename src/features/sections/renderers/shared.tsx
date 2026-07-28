import {
  Baby,
  BedDouble,
  Building2,
  Cake,
  Camera,
  Car,
  Church,
  Clock,
  Gem,
  Gift,
  Heart,
  Home,
  MapPin,
  Music,
  PartyPopper,
  Sparkles,
  Star,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { formatDate, formatTime } from '@/i18n/format';
import type { Locale } from '@/i18n/config';

import type { IconName } from '../shared-schemas';
import type { InvitationRenderContext, MediaResolution } from '../types';

/**
 * Zajednički delovi renderera.
 *
 * Sve je bez `'use client'`: ovi pomoćnici se izvršavaju na serveru i ne šalju
 * nijedan bajt JavaScripta gostu.
 */

/** Kontrolisan skup ikona; korisnik bira iz njega, ne unosi proizvoljan naziv. */
const ICONS: Record<IconName, LucideIcon> = {
  church: Church,
  home: Home,
  building: Building2,
  restaurant: UtensilsCrossed,
  cake: Cake,
  rings: Gem,
  camera: Camera,
  music: Music,
  car: Car,
  bed: BedDouble,
  gift: Gift,
  heart: Heart,
  star: Star,
  clock: Clock,
  'map-pin': MapPin,
  baby: Baby,
  balloon: PartyPopper,
  utensils: UtensilsCrossed,
  glass: Wine,
  sparkles: Sparkles,
};

export function SectionIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

/**
 * Okvir sekcije.
 *
 * Svaka sekcija dobija `<section>` sa naslovom vezanim preko `aria-labelledby`,
 * pa čitač ekrana može da skače kroz pozivnicu po sekcijama (zahtev 31).
 */
export function SectionShell({
  id,
  title,
  intro,
  index,
  wide = false,
  center = false,
  children,
}: {
  id: string;
  title?: string;
  intro?: string;
  index: number;
  wide?: boolean;
  center?: boolean;
  children: ReactNode;
}) {
  const headingId = `${id}-naslov`;
  const hasTitle = Boolean(title && title.trim());

  return (
    <section
      className="inv-section inv-reveal"
      aria-labelledby={hasTitle ? headingId : undefined}
      // Kasnije sekcije kreću sa malim zakašnjenjem, ali nikad toliko da
      // sadržaj čeka - gornja granica je pola sekunde.
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className={wide ? 'inv-container inv-container--wide' : 'inv-container'}>
        <div className={center ? 'inv-stack inv-center' : 'inv-stack'}>
          {hasTitle ? (
            <header className={center ? 'inv-stack inv-center' : 'inv-stack'}>
              <h2 id={headingId}>{title}</h2>
              {intro ? <p className="inv-muted">{intro}</p> : null}
            </header>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}

export function Divider() {
  return <div className="inv-divider" aria-hidden />;
}

/** Razrešava referencu na fotografiju; `null` kada slika nije otpremljena. */
export function resolveMedia(
  context: InvitationRenderContext,
  ref: { assetId: string; alt?: string; focalX?: number; focalY?: number } | null,
): MediaResolution | null {
  if (!ref) return null;

  const asset = context.media[ref.assetId];
  if (!asset) return null;

  // Alt tekst zadat na sekciji ima prednost nad onim na samom fajlu: ista
  // fotografija u različitom kontekstu treba drugačiji opis.
  return {
    ...asset,
    alt: ref.alt?.trim() || asset.alt,
    focalX: ref.focalX ?? asset.focalX,
    focalY: ref.focalY ?? asset.focalY,
  };
}

/**
 * Slika u pozivnici.
 *
 * Koristi običan `<img>` sa `loading="lazy"` umesto `next/image`: fotografije
 * dolaze sa konfigurabilnog storage hosta, a `next/image` bi za svaki novi host
 * tražio izmenu `next.config.ts`. Veličine i `decoding="async"` daju isti
 * efekat na performanse za ovaj slučaj upotrebe.
 */
export function InvitationImage({
  media,
  className,
  priority = false,
  sizes,
}: {
  media: MediaResolution;
  className?: string;
  /** Naslovna fotografija se učitava odmah; sve ostale lenjo. */
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <img
      src={media.url}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      sizes={sizes}
      className={className ? `inv-image ${className}` : 'inv-image'}
      style={{
        objectPosition: `${media.focalX}% ${media.focalY}%`,
        backgroundImage: media.placeholder ? `url(${media.placeholder})` : undefined,
        backgroundSize: 'cover',
      }}
    />
  );
}

/** Datum početka događaja kao `Date`, ili `null` ako još nije zadat. */
export function eventDate(context: InvitationRenderContext): Date | null {
  if (!context.startsAt) return null;
  const parsed = new Date(context.startsAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEventDate(
  context: InvitationRenderContext,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string | null {
  const date = eventDate(context);
  if (!date) return null;
  return formatDate(date, locale, { timeZone: context.timeZone, ...options });
}

export function formatEventTime(
  context: InvitationRenderContext,
  locale: Locale,
): string | null {
  const date = eventDate(context);
  if (!date) return null;
  return formatTime(date, locale, { timeZone: context.timeZone });
}

/** Spaja vreme zadato na sekciji (`ČČ:MM`) sa datumom događaja radi prikaza. */
export function formatLocalTime(time: string | null): string | null {
  return time && time.length > 0 ? time : null;
}
