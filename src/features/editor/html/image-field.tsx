'use client';

import { ImagePlus, RotateCcw, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { useTranslations } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/server/services/media';

import { useEditorConfig } from '../context';
import { uploadImage } from '../upload';
import { useFieldEditorDispatch, useFieldEditorState } from './store';

/**
 * Izbor fotografije za polje HTML šablona (zahtev 9 i 39.4).
 *
 * Polje čuva **ključ** otpremljene fotografije ili putanju slike iz samog
 * šablona - nikad URL. Zahvaljujući tome promena skladišta ili domena ne traži
 * prepisivanje sadržaja pozivnica, a slika iz šablona ostaje dostupna i kad
 * organizator nije otpremio ništa svoje.
 *
 * Otpremanje ide kroz isti tok kao i kod sekcija (`uploadImage`): fotografija
 * se prekodira u pregledaču, pa šalje potpisanim URL-om pravo u skladište.
 */
export function ImageField({
  label,
  hint,
  value,
  defaultValue,
  preview,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  /** Slika iz šablona; dugme „vrati" je vraća. */
  defaultValue: string;
  /** Adresa za prikaz trenutne vrednosti; `null` kad je fotografija obrisana. */
  preview: string | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>

      <div className="flex items-start gap-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-muted">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element -- fotografije dolaze sa konfigurabilnog storage hosta */
            <img src={preview} alt="" className="size-full object-cover" />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-describedby={`${id}-label`}
            onClick={() => setOpen(true)}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {t('editor.html.chooseImage')}
          </Button>

          {defaultValue !== '' && value !== defaultValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(defaultValue)}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('editor.html.resetImage')}
            </Button>
          ) : null}
        </div>
      </div>

      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <ImagePicker
        open={open}
        onOpenChange={setOpen}
        onPick={(assetId) => {
          onChange(assetId);
          setOpen(false);
        }}
        selectedId={value}
      />
    </div>
  );
}

function ImagePicker({
  open,
  onOpenChange,
  onPick,
  selectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (assetId: string) => void;
  selectedId: string;
}) {
  const t = useTranslations();
  const config = useEditorConfig();
  const state = useFieldEditorState();
  const dispatch = useFieldEditorDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null): Promise<MediaAsset | null> => {
    const file = files?.[0];
    if (!file) return null;

    setBusy(true);
    setError(null);

    const result = await uploadImage(config.eventId, file, '');

    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return null;
    }

    dispatch({ kind: 'addMedia', assets: [result.asset] });
    return result.asset;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('editor.html.pickerTitle')}</DialogTitle>
          <DialogDescription>{t('editor.html.pickerDescription')}</DialogDescription>
        </DialogHeader>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="space-y-4">
          {/*
            Sam `input[type=file]` je sakriven i van redosleda tabulatora;
            vidljivo dugme ispod ga otvara. Bez toga bi čitač ekrana našao dve
            kontrole sa istim nazivom.
          */}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept="image/*"
            onChange={async (event) => {
              const asset = await upload(event.target.files);
              event.target.value = '';
              if (asset) onPick(asset.id);
            }}
          />

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden />
            {busy ? t('editor.media.uploading') : t('editor.media.upload')}
          </Button>

          {state.media.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('editor.media.empty')}
            </p>
          ) : (
            <ul className="grid max-h-[45vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {state.media.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => onPick(asset.id)}
                    aria-pressed={asset.id === selectedId}
                    className={cn(
                      'block aspect-square w-full overflow-hidden rounded-[var(--radius)] border-2 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      asset.id === selectedId
                        ? 'border-primary'
                        : 'border-transparent hover:border-border',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- fotografije dolaze sa konfigurabilnog storage hosta */}
                    <img
                      src={asset.url}
                      alt={asset.altText}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
