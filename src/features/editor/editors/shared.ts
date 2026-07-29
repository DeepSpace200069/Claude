'use client';

import { useMemo } from 'react';

import { useTranslations } from '@/i18n/client';
import type { Messages } from '@/i18n/messages';
import type { Translator } from '@/i18n/translator';
import { newId } from '@/lib/uuid';

import type { Choice } from '../fields/basic';
import type { ListFieldLabels } from '../fields/list';
import type { MediaLabels } from '../fields/media';
import type { RichTextLabels } from '../fields/rich-text';

/**
 * Zajednički deo svih editora sekcija.
 *
 * Editori ne sadrže nijedan tekst koji korisnik vidi - sve prolazi kroz katalog
 * poruka (zahtev 4). Ovi pomoćnici prave prevedene skupove opcija i labela, pa
 * pojedinačni editor ostaje kratak i bavi se samo svojim poljima.
 */
export type EditorTranslator = Translator<Messages>;

export function useEditorTranslator(): EditorTranslator {
  return useTranslations();
}

/** Opcije za izbor iz zatvorenog skupa; labela dolazi iz `editor.options.*`. */
export function choices<T extends string>(
  t: EditorTranslator,
  group: string,
  values: readonly T[],
): Choice[] {
  return values.map((value) => ({
    value,
    label: t.dynamic(`editor.options.${group}.${value}`),
  }));
}

/** Opcije čije su vrednosti brojevi (broj kolona). */
export function numberChoices(values: readonly number[]): Choice[] {
  return values.map((value) => ({ value: String(value), label: String(value) }));
}

export function useListLabels(): ListFieldLabels {
  const t = useEditorTranslator();
  return useMemo(
    () => ({
      add: t('editor.list.add'),
      remove: t('editor.list.remove'),
      moveUp: t('editor.list.moveUp'),
      moveDown: t('editor.list.moveDown'),
      empty: t('editor.list.empty'),
    }),
    [t],
  );
}

export function useMediaLabels(): MediaLabels {
  const t = useEditorTranslator();
  return useMemo(
    () => ({
      choose: t('editor.media.choose'),
      change: t('editor.media.change'),
      remove: t('editor.media.remove'),
      empty: t('editor.media.empty'),
      dialogTitle: t('editor.media.dialogTitle'),
      dialogDescription: t('editor.media.dialogDescription'),
      upload: t('editor.media.upload'),
      uploading: t('editor.media.uploading'),
      altLabel: t('editor.media.altLabel'),
      altHint: t('editor.media.altHint'),
      focalX: t('editor.media.focalX'),
      focalY: t('editor.media.focalY'),
      limitReached: t('editor.media.limitReached'),
      deletePhoto: t('editor.media.deletePhoto'),
      librarySelected: t('editor.media.librarySelected'),
    }),
    [t],
  );
}

export function useRichTextLabels(): RichTextLabels {
  const t = useEditorTranslator();
  return useMemo(
    () => ({
      title: t('editor.richText.title'),
      empty: t('editor.richText.empty'),
      add: t('editor.list.add'),
      remove: t('editor.richText.remove'),
      moveUp: t('editor.richText.moveUp'),
      moveDown: t('editor.richText.moveDown'),
      listItemPlaceholder: t('editor.richText.listItemPlaceholder'),
      addListItem: t('editor.richText.addListItem'),
      kinds: {
        paragraph: t('editor.richText.kinds.paragraph'),
        heading: t('editor.richText.kinds.heading'),
        list: t('editor.richText.kinds.list'),
        quote: t('editor.richText.kinds.quote'),
      },
    }),
    [t],
  );
}

/**
 * Naslov stavke u listi.
 *
 * Prazna stavka bi inače imala prazno zaglavlje, pa korisnik ne bi znao šta
 * otvara - zato uvek postoji rezervni naziv sa rednim brojem.
 */
export function itemTitle(
  t: EditorTranslator,
  value: string,
  index: number,
): string {
  const trimmed = value.trim();
  return trimmed || t('editor.list.itemFallback', { position: index + 1 });
}

/**
 * Identifikator stavke u listi.
 *
 * Stavke sekcija imaju sopstveni `id` u šemi, pa React ključ ostaje stabilan i
 * kada se lista prerasporedi - bez toga bi se stanje polja pomeralo zajedno sa
 * pozicijom, a ne sa sadržajem.
 */
export function newItemId(): string {
  return newId();
}
