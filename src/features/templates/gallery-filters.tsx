'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };

/**
 * Filteri galerije šablona.
 *
 * Stanje je u URL-u, ne u React stanju: filtrirana galerija se može podeliti
 * linkom, otvoriti u novom tabu i indeksirati, a stranica ostaje serverski
 * renderovana. Forma je pravi `<form method="get">`, pa filtriranje radi i bez
 * JavaScripta - skripta samo dodaje automatsko slanje pri promeni (zahtev 22).
 */
export function GalleryFilters({
  styles,
  colorGroups,
  labels,
  basePath,
}: {
  styles: FilterOption[];
  colorGroups: FilterOption[];
  labels: {
    style: string;
    color: string;
    photos: string;
    photosAny: string;
    photosWith: string;
    photosWithout: string;
    sort: string;
    sortRecommended: string;
    sortNewest: string;
    sortName: string;
    all: string;
    apply: string;
    clear: string;
  };
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const current = {
    stil: searchParams.get('stil') ?? '',
    boja: searchParams.get('boja') ?? '',
    fotografije: searchParams.get('fotografije') ?? '',
    redosled: searchParams.get('redosled') ?? '',
  };

  const hasFilters = Object.values(current).some((value) => value !== '');

  /** Pri promeni odmah primenjujemo filter, bez klika na dugme. */
  const submitNow = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-soft"
    >
      <FilterSelect
        name="stil"
        label={labels.style}
        value={current.stil}
        options={[{ value: '', label: labels.all }, ...styles]}
        onChange={submitNow}
      />

      <FilterSelect
        name="boja"
        label={labels.color}
        value={current.boja}
        options={[{ value: '', label: labels.all }, ...colorGroups]}
        onChange={submitNow}
      />

      <FilterSelect
        name="fotografije"
        label={labels.photos}
        value={current.fotografije}
        options={[
          { value: '', label: labels.photosAny },
          { value: 'da', label: labels.photosWith },
          { value: 'ne', label: labels.photosWithout },
        ]}
        onChange={submitNow}
      />

      <FilterSelect
        name="redosled"
        label={labels.sort}
        value={current.redosled}
        options={[
          { value: '', label: labels.sortRecommended },
          { value: 'najnoviji', label: labels.sortNewest },
          { value: 'naziv', label: labels.sortName },
        ]}
        onChange={submitNow}
      />

      {/* Vidljivo samo bez JavaScripta - sa skriptom se filter primeni odmah. */}
      <noscript>
        <button type="submit" className="h-10 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground">
          {labels.apply}
        </button>
      </noscript>

      {hasFilters ? (
        <Link
          href={basePath}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
          {labels.clear}
        </Link>
      ) : null}
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (name: string, value: string) => void;
}) {
  const id = `filter-${name}`;

  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        onChange={(event) => onChange(name, event.target.value)}
        className={cn(
          'h-10 rounded-[var(--radius)] border border-input bg-surface px-3 text-sm',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
