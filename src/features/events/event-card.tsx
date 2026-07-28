import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Kartica događaja u listi.
 *
 * Prima gotove tekstove umesto prevodioca: kartica ne treba da zna ništa o
 * jeziku, pa je lako iskoristiti je i u pregledu za saradnike i u admin panelu.
 */
export function EventCard({
  id,
  name,
  city,
  typeLabel,
  statusLabel,
  status,
  dateLabel,
  countdownLabel,
  openLabel,
}: {
  id: string;
  name: string;
  city: string | null;
  typeLabel: string;
  statusLabel: string;
  status: 'draft' | 'published' | 'archived';
  dateLabel: string | null;
  countdownLabel: string | null;
  openLabel: string;
}) {
  const statusVariant =
    status === 'published' ? 'success' : status === 'archived' ? 'neutral' : 'warning';

  return (
    <Card className="group h-full transition-all hover:-translate-y-0.5 hover:shadow-lifted">
      <CardContent className="flex h-full flex-col p-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="primary">{typeLabel}</Badge>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>

        <h2 className="mt-4 font-display text-xl font-semibold leading-snug">
          <Link
            href={`/app/dogadjaji/${id}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </h2>

        <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {dateLabel ? (
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              <dd>{dateLabel}</dd>
            </div>
          ) : null}
          {city ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <dd>{city}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="text-sm font-medium text-foreground">
            {countdownLabel ?? ''}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            {openLabel}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
