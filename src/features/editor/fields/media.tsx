'use client';

import { ImagePlus, Trash2, Upload, X } from 'lucide-react';
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
import type { MediaRef } from '@/features/sections/shared-schemas';
import type { MediaAsset } from '@/server/services/media';
import { deleteMediaAction } from '@/server/actions/media';
import { cn } from '@/lib/utils';

import { useEditorConfig } from '../context';
import { useEditorDispatch, useEditorState } from '../store';
import { uploadImage } from '../upload';
import { RangeField, TextField } from './basic';

/**
 * Izbor fotografije za sekciju (zahtev 9 i 24).
 *
 * Sekcija čuva samo `assetId` i podatke prikaza (alt tekst, fokusna tačka), a
 * ne URL: promena skladišta ili CDN domena zato ne traži prepisivanje sadržaja
 * pozivnica.
 */

export type MediaLabels = {
  choose: string;
  change: string;
  remove: string;
  empty: string;
  dialogTitle: string;
  dialogDescription: string;
  upload: string;
  uploading: string;
  altLabel: string;
  altHint: string;
  focalX: string;
  focalY: string;
  limitReached: string;
  deletePhoto: string;
  librarySelected: string;
};

/** Zajednička logika otpremanja - koriste je i jedna slika i galerija. */
function useUploader() {
  const config = useEditorConfig();
  const dispatch = useEditorDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null): Promise<MediaAsset[]> => {
    if (!files || files.length === 0) return [];

    setBusy(true);
    setError(null);
    const uploaded: MediaAsset[] = [];

    for (const file of Array.from(files)) {
      const result = await uploadImage(config.eventId, file, '');
      if (!result.ok) {
        setError(result.message);
        break;
      }
      dispatch({ kind: 'mediaAdded', asset: result.asset });
      uploaded.push(result.asset);
    }

    setBusy(false);
    return uploaded;
  };

  return { upload, busy, error, setError };
}

function MediaPicker({
  open,
  onOpenChange,
  labels,
  selectedIds,
  onPick,
  multiple,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: MediaLabels;
  selectedIds: readonly string[];
  onPick: (asset: MediaAsset) => void;
  multiple: boolean;
}) {
  const { media } = useEditorState();
  const dispatch = useEditorDispatch();
  const config = useEditorConfig();
  const { upload, busy, error } = useUploader();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const remove = async (assetId: string) => {
    const result = await deleteMediaAction({
      eventId: config.eventId,
      assetId,
    });
    if (result.ok) dispatch({ kind: 'mediaRemoved', assetId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{labels.dialogTitle}</DialogTitle>
          <DialogDescription>{labels.dialogDescription}</DialogDescription>
        </DialogHeader>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="space-y-4">
          <div>
            {/*
              Sam `input[type=file]` je sakriven i van redosleda tabulatora:
              vidljivo dugme ispod ga otvara. Bez `aria-hidden` bi čitač ekrana
              našao dve kontrole sa istim nazivom, a korisnik ne bi znao koja je
              prava.
            */}
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              multiple={multiple}
              accept="image/*"
              onChange={async (event) => {
                const uploaded = await upload(event.target.files);
                event.target.value = '';
                const first = uploaded[0];
                if (first && !multiple) {
                  onPick(first);
                  onOpenChange(false);
                } else {
                  for (const asset of uploaded) onPick(asset);
                }
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
              {busy ? labels.uploading : labels.upload}
            </Button>
          </div>

          {media.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {labels.empty}
            </p>
          ) : (
            <ul className="grid max-h-[45vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {media.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                return (
                  <li key={asset.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(asset);
                        if (!multiple) onOpenChange(false);
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        'block aspect-square w-full overflow-hidden rounded-[var(--radius)] border-2 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        isSelected ? 'border-primary' : 'border-transparent hover:border-border',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- fotografije dolaze sa konfigurabilnog storage hosta */}
                      <img
                        src={asset.url}
                        alt={asset.altText}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                      {isSelected ? (
                        <span className="sr-only">{labels.librarySelected}</span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => void remove(asset.id)}
                      aria-label={labels.deletePhoto}
                      title={labels.deletePhoto}
                      className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow-soft transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MediaField({
  label,
  value,
  onChange,
  labels,
}: {
  label: string;
  value: MediaRef | null;
  onChange: (value: MediaRef | null) => void;
  labels: MediaLabels;
}) {
  const { media } = useEditorState();
  const [open, setOpen] = useState(false);
  const asset = value ? media.find((item) => item.id === value.assetId) : undefined;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>

      {value && asset ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-[var(--radius)] border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- vidi gore */}
            <img
              src={asset.url}
              alt={value.alt || asset.altText}
              className="aspect-video w-full object-cover"
              style={{ objectPosition: `${value.focalX}% ${value.focalY}%` }}
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={labels.remove}
              title={labels.remove}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow-soft transition-colors hover:text-destructive"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <TextField
            label={labels.altLabel}
            hint={labels.altHint}
            value={value.alt}
            maxLength={180}
            onChange={(alt) => onChange({ ...value, alt })}
          />

          <div className="grid grid-cols-2 gap-3">
            <RangeField
              label={labels.focalX}
              value={value.focalX}
              unit="%"
              onChange={(focalX) => onChange({ ...value, focalX })}
            />
            <RangeField
              label={labels.focalY}
              value={value.focalY}
              unit="%"
              onChange={(focalY) => onChange({ ...value, focalY })}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setOpen(true)}
          >
            <ImagePlus aria-hidden />
            {labels.change}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          <ImagePlus aria-hidden />
          {labels.choose}
        </Button>
      )}

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        labels={labels}
        multiple={false}
        selectedIds={value ? [value.assetId] : []}
        onPick={(picked) =>
          onChange({
            assetId: picked.id,
            alt: value?.alt || picked.altText,
            focalX: value?.focalX ?? 50,
            focalY: value?.focalY ?? 50,
          })
        }
      />
    </section>
  );
}

export function GalleryField({
  label,
  value,
  onChange,
  labels,
  max,
}: {
  label: string;
  value: readonly MediaRef[];
  onChange: (value: MediaRef[]) => void;
  labels: MediaLabels;
  max?: number;
}) {
  const { media } = useEditorState();
  const [open, setOpen] = useState(false);
  const selectedIds = value.map((item) => item.assetId);

  const toggle = (asset: MediaAsset) => {
    if (selectedIds.includes(asset.id)) {
      onChange(value.filter((item) => item.assetId !== asset.id));
      return;
    }
    if (max !== undefined && value.length >= max) return;
    onChange([
      ...value,
      { assetId: asset.id, alt: asset.altText, focalX: 50, focalY: 50 },
    ]);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>

      {value.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {value.map((item, index) => {
            const asset = media.find((candidate) => candidate.id === item.assetId);
            if (!asset) return null;
            return (
              <li key={item.assetId} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- vidi gore */}
                <img
                  src={asset.url}
                  alt={item.alt || asset.altText}
                  className="aspect-square w-full rounded-[var(--radius)] border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(value.filter((_, i) => i !== index))
                  }
                  aria-label={labels.remove}
                  title={labels.remove}
                  className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow-soft transition-colors hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={max !== undefined && value.length >= max}
        onClick={() => setOpen(true)}
      >
        <ImagePlus aria-hidden />
        {max !== undefined && value.length >= max ? labels.limitReached : labels.choose}
      </Button>

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        labels={labels}
        multiple
        selectedIds={selectedIds}
        onPick={toggle}
      />
    </section>
  );
}
