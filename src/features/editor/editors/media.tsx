'use client';

import type { z } from 'zod';

import type {
  gallerySection,
  musicSection,
  storySection,
} from '@/features/sections/definitions/media';
import type { SectionEditorProps } from '@/features/sections/types';
import { limitFor } from '@/features/billing/entitlements';

import { useEditorConfig } from '../context';
import {
  ChoiceField,
  RangeField,
  SwitchField,
  TextAreaField,
  TextField,
} from '../fields/basic';
import { ListField } from '../fields/list';
import { GalleryField, MediaField } from '../fields/media';
import {
  choices,
  itemTitle,
  newItemId,
  numberChoices,
  useEditorTranslator,
  useListLabels,
  useMediaLabels,
} from './shared';

/** Editori sekcija sa fotografijama, pričom i muzikom (zahtev 9). */

type GalleryData = z.infer<typeof gallerySection.schema>;

export function GalleryEditor({ data, onChange }: SectionEditorProps<GalleryData>) {
  const t = useEditorTranslator();
  const mediaLabels = useMediaLabels();
  const { entitlements } = useEditorConfig();

  // Limit dolazi iz paketa, a ne iz šeme sekcije - isto pravilo važi i pri
  // izdavanju karte za otpremanje na serveru (zahtev 39.9).
  const maxPhotos = limitFor(entitlements, 'maxPhotos');

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextAreaField
        label={t('editor.fields.intro')}
        value={data.intro}
        rows={3}
        onChange={(intro) => onChange({ ...data, intro }, 'intro')}
      />

      <GalleryField
        label={t('editor.fields.images')}
        value={data.images}
        labels={mediaLabels}
        max={maxPhotos ?? undefined}
        onChange={(images) => onChange({ ...data, images })}
      />

      <ChoiceField
        label={t('editor.fields.layout')}
        value={data.layout}
        options={choices(t, 'listLayout', [
          'grid',
          'masonry',
          'carousel',
          'strip',
        ] as const)}
        onChange={(layout) =>
          onChange({ ...data, layout: layout as GalleryData['layout'] })
        }
      />
      <ChoiceField
        label={t('editor.fields.columns')}
        value={String(data.columns)}
        options={numberChoices([2, 3, 4])}
        onChange={(columns) =>
          onChange({ ...data, columns: Number(columns) as GalleryData['columns'] })
        }
      />
      <ChoiceField
        label={t('editor.fields.aspectRatio')}
        value={data.aspectRatio}
        options={choices(t, 'aspectRatio', [
          'original',
          'square',
          'portrait',
          'landscape',
        ] as const)}
        onChange={(aspectRatio) =>
          onChange({
            ...data,
            aspectRatio: aspectRatio as GalleryData['aspectRatio'],
          })
        }
      />
      <SwitchField
        label={t('editor.fields.enableLightbox')}
        checked={data.enableLightbox}
        onChange={(enableLightbox) => onChange({ ...data, enableLightbox })}
      />
    </div>
  );
}

type StoryData = z.infer<typeof storySection.schema>;

export function StoryEditor({ data, onChange }: SectionEditorProps<StoryData>) {
  const t = useEditorTranslator();
  const listLabels = useListLabels();
  const mediaLabels = useMediaLabels();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextAreaField
        label={t('editor.fields.intro')}
        value={data.intro}
        rows={3}
        onChange={(intro) => onChange({ ...data, intro }, 'intro')}
      />
      <ChoiceField
        label={t('editor.fields.style')}
        value={data.style}
        options={choices(t, 'listLayout', [
          'timeline',
          'alternating',
          'cards',
        ] as const)}
        onChange={(style) => onChange({ ...data, style: style as StoryData['style'] })}
      />

      <ListField
        label={t('editor.fields.entries')}
        items={data.entries}
        labels={listLabels}
        max={30}
        getKey={(item) => item.id}
        getTitle={(item, index) => itemTitle(t, item.title, index)}
        createItem={() => ({
          id: newItemId(),
          label: '',
          date: null,
          title: '',
          text: '',
          image: null,
        })}
        onChange={(entries) => onChange({ ...data, entries })}
        renderItem={(item, update) => (
          <>
            <TextField
              label={t('editor.fields.label')}
              value={item.label}
              maxLength={60}
              onChange={(label) => update({ ...item, label })}
            />
            <TextField
              label={t('editor.fields.date')}
              type="date"
              value={item.date ?? ''}
              onChange={(date) => update({ ...item, date: date || null })}
            />
            <TextField
              label={t('editor.fields.title')}
              value={item.title}
              maxLength={120}
              onChange={(title) => update({ ...item, title })}
            />
            <TextAreaField
              label={t('editor.fields.text')}
              value={item.text}
              rows={3}
              onChange={(text) => update({ ...item, text })}
            />
            <MediaField
              label={t('editor.fields.image')}
              value={item.image}
              labels={mediaLabels}
              onChange={(image) => update({ ...item, image })}
            />
          </>
        )}
      />
    </div>
  );
}

type MusicData = z.infer<typeof musicSection.schema>;

export function MusicEditor({ data, onChange }: SectionEditorProps<MusicData>) {
  const t = useEditorTranslator();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <ChoiceField
        label={t('editor.fields.source')}
        value={data.source}
        options={choices(t, 'musicSource', ['library', 'upload', 'link'] as const)}
        onChange={(source) =>
          onChange({ ...data, source: source as MusicData['source'] })
        }
      />

      {data.source === 'library' ? (
        <TextField
          label={t('editor.fields.libraryTrackId')}
          value={data.libraryTrackId}
          maxLength={60}
          onChange={(libraryTrackId) => onChange({ ...data, libraryTrackId })}
        />
      ) : null}

      {data.source === 'link' ? (
        <TextField
          label={t('editor.fields.externalUrl')}
          type="url"
          value={data.externalUrl ?? ''}
          placeholder="https://"
          onChange={(url) => onChange({ ...data, externalUrl: url || null })}
        />
      ) : null}

      <SwitchField
        label={t('editor.fields.showControls')}
        checked={data.showControls}
        onChange={(showControls) => onChange({ ...data, showControls })}
      />
      <SwitchField
        label={t('editor.fields.autoplay')}
        hint={t('editor.fields.autoplayHint')}
        checked={data.autoplayAfterInteraction}
        onChange={(autoplayAfterInteraction) =>
          onChange({ ...data, autoplayAfterInteraction })
        }
      />
      <SwitchField
        label={t('editor.fields.loop')}
        checked={data.loop}
        onChange={(loop) => onChange({ ...data, loop })}
      />
      <RangeField
        label={t('editor.fields.volume')}
        value={data.volume}
        unit="%"
        onChange={(volume) => onChange({ ...data, volume })}
      />
    </div>
  );
}
