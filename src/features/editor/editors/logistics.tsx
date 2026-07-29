'use client';

import type { z } from 'zod';

import type {
  infoCardsSection,
  locationsSection,
  peopleSection,
  scheduleSection,
} from '@/features/sections/definitions/logistics';
import type { IconName } from '@/features/sections/shared-schemas';
import type { SectionEditorProps } from '@/features/sections/types';

import {
  ChoiceField,
  SwitchField,
  TextAreaField,
  TextField,
} from '../fields/basic';
import { IconField } from '../fields/icon';
import { ListField } from '../fields/list';
import { MediaField } from '../fields/media';
import {
  choices,
  itemTitle,
  newItemId,
  numberChoices,
  useEditorTranslator,
  useListLabels,
  useMediaLabels,
} from './shared';

/** Editori sekcija koje odgovaraju na „gde", „kada" i „ko" (zahtev 9). */

type LocationsData = z.infer<typeof locationsSection.schema>;

export function LocationsEditor({ data, onChange }: SectionEditorProps<LocationsData>) {
  const t = useEditorTranslator();
  const listLabels = useListLabels();
  const iconLabel = (name: IconName) => t.dynamic(`editor.icons.${name}`);

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
        label={t('editor.fields.layout')}
        value={data.layout}
        options={choices(t, 'listLayout', ['cards', 'list', 'timeline'] as const)}
        onChange={(layout) =>
          onChange({ ...data, layout: layout as LocationsData['layout'] })
        }
      />

      <ListField
        label={t('editor.fields.locations')}
        items={data.locations}
        labels={listLabels}
        max={10}
        getKey={(item) => item.id}
        getTitle={(item, index) => itemTitle(t, item.name, index)}
        createItem={() => ({
          id: newItemId(),
          name: '',
          address: '',
          description: '',
          icon: 'map-pin' as const,
          date: null,
          time: null,
          coordinates: null,
          googleMapsUrl: null,
          appleMapsUrl: null,
          showMap: false,
          parkingNote: '',
          accessibilityNote: '',
          contactPhone: '',
          contactEmail: '',
        })}
        onChange={(locations) => onChange({ ...data, locations })}
        renderItem={(item, update) => (
          <>
            <TextField
              label={t('editor.fields.name')}
              value={item.name}
              maxLength={120}
              onChange={(name) => update({ ...item, name })}
            />
            <TextField
              label={t('editor.fields.address')}
              value={item.address}
              maxLength={200}
              onChange={(address) => update({ ...item, address })}
            />
            <TextAreaField
              label={t('editor.fields.description')}
              value={item.description}
              rows={2}
              onChange={(description) => update({ ...item, description })}
            />

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('editor.fields.date')}
                type="date"
                value={item.date ?? ''}
                onChange={(date) => update({ ...item, date: date || null })}
              />
              <TextField
                label={t('editor.fields.time')}
                type="time"
                value={item.time ?? ''}
                onChange={(time) => update({ ...item, time: time || null })}
              />
            </div>

            <IconField
              label={t('editor.fields.icon')}
              value={item.icon}
              iconLabel={iconLabel}
              onChange={(icon) => update({ ...item, icon })}
            />

            <TextField
              label={t('editor.fields.googleMaps')}
              type="url"
              value={item.googleMapsUrl ?? ''}
              placeholder="https://"
              onChange={(url) => update({ ...item, googleMapsUrl: url || null })}
            />
            <TextField
              label={t('editor.fields.appleMaps')}
              type="url"
              value={item.appleMapsUrl ?? ''}
              placeholder="https://"
              onChange={(url) => update({ ...item, appleMapsUrl: url || null })}
            />
            <SwitchField
              label={t('editor.fields.showMap')}
              checked={item.showMap}
              onChange={(showMap) => update({ ...item, showMap })}
            />

            <TextField
              label={t('editor.fields.parkingNote')}
              value={item.parkingNote}
              maxLength={300}
              onChange={(parkingNote) => update({ ...item, parkingNote })}
            />
            <TextField
              label={t('editor.fields.accessibilityNote')}
              value={item.accessibilityNote}
              maxLength={300}
              onChange={(accessibilityNote) => update({ ...item, accessibilityNote })}
            />
            <TextField
              label={t('editor.fields.phone')}
              type="tel"
              value={item.contactPhone}
              maxLength={32}
              onChange={(contactPhone) => update({ ...item, contactPhone })}
            />
            <TextField
              label={t('editor.fields.email')}
              type="email"
              value={item.contactEmail}
              maxLength={160}
              onChange={(contactEmail) => update({ ...item, contactEmail })}
            />
          </>
        )}
      />
    </div>
  );
}

type ScheduleData = z.infer<typeof scheduleSection.schema>;

export function ScheduleEditor({ data, onChange }: SectionEditorProps<ScheduleData>) {
  const t = useEditorTranslator();
  const listLabels = useListLabels();
  const mediaLabels = useMediaLabels();
  const iconLabel = (name: IconName) => t.dynamic(`editor.icons.${name}`);

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
        options={choices(t, 'listLayout', ['timeline', 'list', 'cards'] as const)}
        onChange={(style) =>
          onChange({ ...data, style: style as ScheduleData['style'] })
        }
      />

      <ListField
        label={t('editor.fields.scheduleItems')}
        items={data.items}
        labels={listLabels}
        max={24}
        getKey={(item) => item.id}
        getTitle={(item, index) => itemTitle(t, item.title, index)}
        createItem={() => ({
          id: newItemId(),
          time: null,
          title: '',
          description: '',
          locationRef: '',
          locationLabel: '',
          icon: 'clock' as const,
          image: null,
        })}
        onChange={(items) => onChange({ ...data, items })}
        renderItem={(item, update) => (
          <>
            <TextField
              label={t('editor.fields.time')}
              type="time"
              value={item.time ?? ''}
              onChange={(time) => update({ ...item, time: time || null })}
            />
            <TextField
              label={t('editor.fields.title')}
              value={item.title}
              maxLength={120}
              onChange={(title) => update({ ...item, title })}
            />
            <TextAreaField
              label={t('editor.fields.description')}
              value={item.description}
              rows={2}
              onChange={(description) => update({ ...item, description })}
            />
            <TextField
              label={t('editor.fields.locationLabel')}
              value={item.locationLabel}
              maxLength={120}
              onChange={(locationLabel) => update({ ...item, locationLabel })}
            />
            <IconField
              label={t('editor.fields.icon')}
              value={item.icon}
              iconLabel={iconLabel}
              onChange={(icon) => update({ ...item, icon })}
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

type InfoCardsData = z.infer<typeof infoCardsSection.schema>;

export function InfoCardsEditor({ data, onChange }: SectionEditorProps<InfoCardsData>) {
  const t = useEditorTranslator();
  const listLabels = useListLabels();
  const iconLabel = (name: IconName) => t.dynamic(`editor.icons.${name}`);

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
        label={t('editor.fields.columns')}
        value={String(data.columns)}
        options={numberChoices([1, 2, 3])}
        onChange={(columns) =>
          onChange({ ...data, columns: Number(columns) as InfoCardsData['columns'] })
        }
      />

      <ListField
        label={t('editor.fields.cards')}
        items={data.cards}
        labels={listLabels}
        max={12}
        getKey={(item) => item.id}
        getTitle={(item, index) => itemTitle(t, item.title, index)}
        createItem={() => ({
          id: newItemId(),
          icon: 'sparkles' as const,
          title: '',
          body: '',
          linkUrl: null,
          linkLabel: '',
        })}
        onChange={(cards) => onChange({ ...data, cards })}
        renderItem={(item, update) => (
          <>
            <TextField
              label={t('editor.fields.title')}
              value={item.title}
              maxLength={80}
              onChange={(title) => update({ ...item, title })}
            />
            <TextAreaField
              label={t('editor.fields.body')}
              value={item.body}
              rows={3}
              onChange={(body) => update({ ...item, body })}
            />
            <IconField
              label={t('editor.fields.icon')}
              value={item.icon}
              iconLabel={iconLabel}
              onChange={(icon) => update({ ...item, icon })}
            />
            <TextField
              label={t('editor.fields.linkUrl')}
              type="url"
              value={item.linkUrl ?? ''}
              placeholder="https://"
              onChange={(linkUrl) => update({ ...item, linkUrl: linkUrl || null })}
            />
            <TextField
              label={t('editor.fields.linkLabel')}
              value={item.linkLabel}
              maxLength={60}
              onChange={(linkLabel) => update({ ...item, linkLabel })}
            />
          </>
        )}
      />
    </div>
  );
}

type PeopleData = z.infer<typeof peopleSection.schema>;

export function PeopleEditor({ data, onChange }: SectionEditorProps<PeopleData>) {
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
        label={t('editor.fields.layout')}
        value={data.layout}
        options={choices(t, 'listLayout', ['grid', 'list', 'cards'] as const)}
        onChange={(layout) =>
          onChange({ ...data, layout: layout as PeopleData['layout'] })
        }
      />
      <SwitchField
        label={t('editor.fields.showPhotos')}
        checked={data.showPhotos}
        onChange={(showPhotos) => onChange({ ...data, showPhotos })}
      />

      <ListField
        label={t('editor.fields.people')}
        items={data.people}
        labels={listLabels}
        max={24}
        getKey={(item) => item.id}
        getTitle={(item, index) => itemTitle(t, item.name, index)}
        createItem={() => ({
          id: newItemId(),
          name: '',
          role: '',
          note: '',
          photo: null,
        })}
        onChange={(people) => onChange({ ...data, people })}
        renderItem={(item, update) => (
          <>
            <TextField
              label={t('editor.fields.name')}
              value={item.name}
              maxLength={80}
              onChange={(name) => update({ ...item, name })}
            />
            <TextField
              label={t('editor.fields.role')}
              value={item.role}
              maxLength={60}
              onChange={(role) => update({ ...item, role })}
            />
            <TextField
              label={t('editor.fields.note')}
              value={item.note}
              maxLength={200}
              onChange={(note) => update({ ...item, note })}
            />
            {data.showPhotos ? (
              <MediaField
                label={t('editor.fields.photo')}
                value={item.photo}
                labels={mediaLabels}
                onChange={(photo) => update({ ...item, photo })}
              />
            ) : null}
          </>
        )}
      />
    </div>
  );
}
