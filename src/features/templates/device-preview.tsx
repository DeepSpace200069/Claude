'use client';

import { Laptop, Maximize2, Smartphone, Tablet } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Device = 'phone' | 'tablet' | 'desktop';

const WIDTHS: Record<Device, string> = {
  phone: '23.5rem',
  tablet: '46rem',
  desktop: '100%',
};

/**
 * Prikaz pozivnice u okviru uređaja (zahtev 7, korak 3).
 *
 * Sadržaj je **serverski renderovana** pozivnica prosleđena kao `children` -
 * prebacivanje uređaja menja samo širinu okvira, ne renderuje ponovo. Zbog toga
 * klijentski JavaScript ovde nosi samo tri dugmeta, a ne celu pozivnicu.
 *
 * Koristi se `container-type: inline-size` na okviru, pa se pozivnica prilagođava
 * širini okvira umesto širini prozora - inače bi „telefon" prikaz izgledao kao
 * desktop na velikom ekranu.
 */
export function DevicePreview({
  labels,
  fullscreenHref,
  children,
}: {
  labels: {
    phone: string;
    tablet: string;
    desktop: string;
    fullscreen: string;
  };
  fullscreenHref: string;
  children: ReactNode;
}) {
  const [device, setDevice] = useState<Device>('desktop');

  const options: Array<{ value: Device; label: string; icon: typeof Laptop }> = [
    { value: 'phone', label: labels.phone, icon: Smartphone },
    { value: 'tablet', label: labels.tablet, icon: Tablet },
    { value: 'desktop', label: labels.desktop, icon: Laptop },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
          role="group"
          aria-label={labels.desktop}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDevice(option.value)}
              aria-pressed={device === option.value}
              /*
               * Naziv je uvek na dugmetu, a ne samo u vidljivom tekstu: na
               * uskim ekranima je tekst sakriven, pa bi bez ovoga dugme za
               * čitač ekrana bilo bezimeno.
               */
              aria-label={option.label}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all',
                device === option.value
                  ? 'bg-surface text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <option.icon className="size-4" aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                {option.label}
              </span>
            </button>
          ))}
        </div>

        <a
          href={fullscreenHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Maximize2 className="size-4" aria-hidden />
          {labels.fullscreen}
        </a>
      </div>

      <div className="flex justify-center">
        <div
          className={cn(
            'w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-lifted transition-[max-width] duration-300',
            device !== 'desktop' && 'border-8 border-sand-900',
          )}
          style={{
            maxWidth: WIDTHS[device],
            containerType: 'inline-size',
          }}
        >
          <div className="max-h-[75svh] overflow-y-auto overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
