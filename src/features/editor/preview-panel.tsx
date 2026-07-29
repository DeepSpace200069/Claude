'use client';

import { Laptop, Maximize2, Minimize2, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';

import { InvitationRenderer } from '@/features/invitations/invitation-renderer';
import type { InvitationRenderContext } from '@/features/sections/types';
import { useLocale, useTranslations } from '@/i18n/client';
import { cn } from '@/lib/utils';

import { mediaMapFromAssets } from './media-map';
import { useEditorDocument, useEditorState } from './store';

import '@/styles/invitation.css';

/**
 * Pregled pozivnice u uređivaču (zahtev 3.9 i 39.4).
 *
 * Renderuje se **istom** komponentom kao demo i kao javna pozivnica, iz istog
 * validiranog modela - pregled zato ne može da prikaže nešto što gost ne bi
 * video. Razliku pravi samo `mode: 'preview'`, zbog kog su forme isključene i
 * jasno označene.
 *
 * Pregled radi nad **trenutnim** dokumentom, a ne nad poslednjim sačuvanim
 * stanjem: izmena se vidi dok se kuca, bez čekanja da autosave završi.
 */
type Device = 'phone' | 'tablet' | 'desktop';

const WIDTHS: Record<Device, string> = {
  phone: '23.5rem',
  tablet: '46rem',
  desktop: '100%',
};

export function PreviewPanel({
  context,
  className,
}: {
  context: Omit<InvitationRenderContext, 'media'>;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const document = useEditorDocument();
  const { media } = useEditorState();
  const [device, setDevice] = useState<Device>('desktop');
  const [fullscreen, setFullscreen] = useState(false);

  const devices: Array<{ value: Device; label: string; icon: typeof Laptop }> = [
    { value: 'phone', label: t('editor.preview.phone'), icon: Smartphone },
    { value: 'tablet', label: t('editor.preview.tablet'), icon: Tablet },
    { value: 'desktop', label: t('editor.preview.desktop'), icon: Laptop },
  ];

  const visible = document.sections.filter((section) => section.isVisible);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-3',
        fullscreen && 'fixed inset-0 z-50 bg-background p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
          role="group"
          aria-label={t('editor.preview.title')}
        >
          {devices.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDevice(option.value)}
              aria-pressed={device === option.value}
              /* Naziv je uvek na dugmetu: tekst je na uskim ekranima sakriven. */
              aria-label={option.label}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
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

        <button
          type="button"
          onClick={() => setFullscreen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          {fullscreen ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
          {fullscreen ? t('editor.preview.exitFullscreen') : t('editor.preview.fullscreen')}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{t('editor.preview.note')}</p>

      <div className="flex min-h-0 flex-1 justify-center">
        <div
          className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-[max-width] duration-300"
          style={{
            maxWidth: WIDTHS[device],
            // Sekcije se prilagođavaju širini okvira, a ne prozora - bez ovoga
            // bi „telefon" prikaz na velikom ekranu izgledao kao desktop.
            containerType: 'inline-size',
          }}
        >
          <div className={cn('overflow-y-auto overscroll-contain', fullscreen ? 'max-h-[calc(100svh-9rem)]' : 'max-h-[70svh]')}>
            {visible.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="font-medium">{t('editor.preview.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('editor.preview.emptyText')}
                </p>
              </div>
            ) : (
              <InvitationRenderer
                sections={document.sections}
                theme={document.theme}
                locale={locale}
                context={{ ...context, media: mediaMapFromAssets(media) }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
