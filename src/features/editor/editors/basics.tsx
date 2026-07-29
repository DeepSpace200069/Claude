'use client';

import type { z } from 'zod';

import type {
  calendarSection,
  contactSection,
  countdownSection,
  customContentSection,
  dateTimeSection,
  footerSection,
  heroSection,
  messageSection,
  namesSection,
} from '@/features/sections/definitions/basics';
import type { SectionEditorProps } from '@/features/sections/types';
import { Checkbox } from '@/components/ui/toggles';
import { Label } from '@/components/ui/label';

import { ButtonField } from '../fields/button';
import {
  ChoiceField,
  FieldGroup,
  RangeField,
  SwitchField,
  TextAreaField,
  TextField,
} from '../fields/basic';
import { ListField } from '../fields/list';
import { MediaField } from '../fields/media';
import { RichTextField } from '../fields/rich-text';
import {
  choices,
  itemTitle,
  useEditorTranslator,
  useListLabels,
  useMediaLabels,
  useRichTextLabels,
} from './shared';

/**
 * Editori osnovnih sekcija (zahtev 9).
 *
 * Svaki editor je čista kontrolisana komponenta: dobije podatke, vrati izmenu.
 * O čuvanju, istoriji i pregledu ne zna ništa - to je posao uređivača, pa se
 * novi tip sekcije dodaje bez ijedne izmene u okolnim komponentama.
 */

type HeroData = z.infer<typeof heroSection.schema>;

export function HeroEditor({ data, onChange }: SectionEditorProps<HeroData>) {
  const t = useEditorTranslator();
  const mediaLabels = useMediaLabels();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.eyebrow')}
        value={data.eyebrow}
        maxLength={60}
        onChange={(eyebrow) => onChange({ ...data, eyebrow }, 'eyebrow')}
      />
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextField
        label={t('editor.fields.subtitle')}
        value={data.subtitle}
        maxLength={200}
        onChange={(subtitle) => onChange({ ...data, subtitle }, 'subtitle')}
      />

      <FieldGroup title={t('editor.fields.layout')}>
        <ChoiceField
          label={t('editor.fields.layout')}
          value={data.layout}
          options={choices(t, 'heroLayout', [
            'centered',
            'split',
            'full-bleed',
            'framed',
          ] as const)}
          onChange={(layout) =>
            onChange({ ...data, layout: layout as HeroData['layout'] })
          }
        />
        <MediaField
          label={t('editor.fields.image')}
          value={data.image}
          labels={mediaLabels}
          onChange={(image) => onChange({ ...data, image })}
        />
        {data.image ? (
          <RangeField
            label={t('editor.fields.overlayOpacity')}
            value={data.overlayOpacity}
            max={80}
            unit="%"
            onChange={(overlayOpacity) => onChange({ ...data, overlayOpacity })}
          />
        ) : null}
        <SwitchField
          label={t('editor.fields.introAnimation')}
          hint={t('editor.fields.introAnimationHint')}
          checked={data.showIntroAnimation}
          onChange={(showIntroAnimation) => onChange({ ...data, showIntroAnimation })}
        />
      </FieldGroup>
    </div>
  );
}

type NamesData = z.infer<typeof namesSection.schema>;

export function NamesEditor({ data, onChange }: SectionEditorProps<NamesData>) {
  const t = useEditorTranslator();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.primaryName')}
        value={data.primaryName}
        maxLength={80}
        onChange={(primaryName) => onChange({ ...data, primaryName }, 'primaryName')}
      />
      <TextField
        label={t('editor.fields.secondaryName')}
        value={data.secondaryName}
        maxLength={80}
        onChange={(secondaryName) =>
          onChange({ ...data, secondaryName }, 'secondaryName')
        }
      />
      <TextField
        label={t('editor.fields.connector')}
        value={data.connector}
        maxLength={8}
        onChange={(connector) => onChange({ ...data, connector }, 'connector')}
      />
      <TextField
        label={t('editor.fields.note')}
        value={data.note}
        maxLength={160}
        onChange={(note) => onChange({ ...data, note }, 'note')}
      />
      <ChoiceField
        label={t('editor.fields.alignment')}
        value={data.alignment}
        options={choices(t, 'alignment', ['left', 'center'] as const)}
        onChange={(alignment) =>
          onChange({ ...data, alignment: alignment as NamesData['alignment'] })
        }
      />
    </div>
  );
}

type DateTimeData = z.infer<typeof dateTimeSection.schema>;

export function DateTimeEditor({ data, onChange }: SectionEditorProps<DateTimeData>) {
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
        label={t('editor.fields.display')}
        value={data.display}
        options={choices(t, 'dateDisplay', [
          'full',
          'compact',
          'stacked',
          'elegant',
        ] as const)}
        onChange={(display) =>
          onChange({ ...data, display: display as DateTimeData['display'] })
        }
      />
      <SwitchField
        label={t('editor.fields.showDayName')}
        checked={data.showDayName}
        onChange={(showDayName) => onChange({ ...data, showDayName })}
      />
      <SwitchField
        label={t('editor.fields.showTime')}
        checked={data.showTime}
        onChange={(showTime) => onChange({ ...data, showTime })}
      />
      <TextField
        label={t('editor.fields.note')}
        value={data.note}
        maxLength={200}
        onChange={(note) => onChange({ ...data, note }, 'note')}
      />
    </div>
  );
}

type CountdownData = z.infer<typeof countdownSection.schema>;

export function CountdownEditor({ data, onChange }: SectionEditorProps<CountdownData>) {
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
        label={t('editor.fields.style')}
        value={data.style}
        options={choices(t, 'countdownStyle', ['boxes', 'inline', 'minimal'] as const)}
        onChange={(style) =>
          onChange({ ...data, style: style as CountdownData['style'] })
        }
      />
      <SwitchField
        label={t('editor.fields.showSeconds')}
        checked={data.showSeconds}
        onChange={(showSeconds) => onChange({ ...data, showSeconds })}
      />
      <TextField
        label={t('editor.fields.afterEventText')}
        value={data.afterEventText}
        maxLength={160}
        onChange={(afterEventText) =>
          onChange({ ...data, afterEventText }, 'afterEventText')
        }
      />
    </div>
  );
}

type MessageData = z.infer<typeof messageSection.schema>;

export function MessageEditor({ data, onChange }: SectionEditorProps<MessageData>) {
  const t = useEditorTranslator();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextAreaField
        label={t('editor.fields.body')}
        value={data.body}
        rows={6}
        maxLength={2000}
        onChange={(body) => onChange({ ...data, body }, 'body')}
      />
      <TextField
        label={t('editor.fields.signature')}
        value={data.signature}
        maxLength={120}
        onChange={(signature) => onChange({ ...data, signature }, 'signature')}
      />
      <ChoiceField
        label={t('editor.fields.alignment')}
        value={data.alignment}
        options={choices(t, 'alignment', ['left', 'center'] as const)}
        onChange={(alignment) =>
          onChange({ ...data, alignment: alignment as MessageData['alignment'] })
        }
      />
      <ChoiceField
        label={t('editor.fields.decoration')}
        value={data.decoration}
        options={choices(t, 'decoration', ['none', 'quote', 'ornament'] as const)}
        onChange={(decoration) =>
          onChange({ ...data, decoration: decoration as MessageData['decoration'] })
        }
      />
    </div>
  );
}

type CalendarData = z.infer<typeof calendarSection.schema>;
const CALENDAR_PROVIDERS = ['ics', 'google', 'outlook'] as const;

export function CalendarEditor({ data, onChange }: SectionEditorProps<CalendarData>) {
  const t = useEditorTranslator();

  const toggleProvider = (provider: (typeof CALENDAR_PROVIDERS)[number]) => {
    const next = data.providers.includes(provider)
      ? data.providers.filter((item) => item !== provider)
      : [...data.providers, provider];

    // Bar jedan način mora da ostane - sekcija bez ijednog dugmeta ne radi
    // ništa, a Zod bi ionako odbio prazan niz pri čuvanju.
    if (next.length === 0) return;
    onChange({ ...data, providers: next });
  };

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextAreaField
        label={t('editor.fields.description')}
        value={data.description}
        rows={3}
        maxLength={300}
        onChange={(description) => onChange({ ...data, description }, 'description')}
      />

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">
          {t('editor.fields.providers')}
        </legend>
        {CALENDAR_PROVIDERS.map((provider) => (
          <div key={provider} className="flex items-center gap-2.5">
            <Checkbox
              id={`kalendar-${provider}`}
              checked={data.providers.includes(provider)}
              onCheckedChange={() => toggleProvider(provider)}
            />
            <Label htmlFor={`kalendar-${provider}`} className="text-sm font-normal">
              {t.dynamic(`editor.options.calendarProvider.${provider}`)}
            </Label>
          </div>
        ))}
      </fieldset>
    </div>
  );
}

type ContactData = z.infer<typeof contactSection.schema>;

export function ContactEditor({ data, onChange }: SectionEditorProps<ContactData>) {
  const t = useEditorTranslator();
  const listLabels = useListLabels();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />
      <TextField
        label={t('editor.fields.note')}
        value={data.note}
        maxLength={200}
        onChange={(note) => onChange({ ...data, note }, 'note')}
      />

      <ListField
        label={t('editor.fields.contacts')}
        items={data.contacts}
        labels={listLabels}
        max={6}
        getKey={(_, index) => `kontakt-${index}`}
        getTitle={(item, index) => itemTitle(t, item.name, index)}
        createItem={() => ({ name: '', role: '', phone: '', email: '' })}
        onChange={(contacts) => onChange({ ...data, contacts })}
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
              label={t('editor.fields.phone')}
              type="tel"
              value={item.phone}
              maxLength={32}
              onChange={(phone) => update({ ...item, phone })}
            />
            <TextField
              label={t('editor.fields.email')}
              type="email"
              value={item.email}
              maxLength={160}
              onChange={(email) => update({ ...item, email })}
            />
          </>
        )}
      />
    </div>
  );
}

type FooterData = z.infer<typeof footerSection.schema>;

export function FooterEditor({ data, onChange }: SectionEditorProps<FooterData>) {
  const t = useEditorTranslator();

  return (
    <div className="space-y-4">
      <TextAreaField
        label={t('editor.fields.footerText')}
        value={data.text}
        rows={3}
        maxLength={300}
        onChange={(text) => onChange({ ...data, text }, 'text')}
      />
      <SwitchField
        label={t('editor.fields.showBranding')}
        checked={data.showBranding}
        onChange={(showBranding) => onChange({ ...data, showBranding })}
      />
      <FieldGroup title={t('editor.fields.button')}>
        <ButtonField
          value={data.button}
          onChange={(button) => onChange({ ...data, button })}
          labels={{
            enabled: t('editor.fields.buttonEnabled'),
            label: t('editor.fields.buttonLabel'),
            url: t('editor.fields.buttonUrl'),
            style: t('editor.fields.buttonStyle'),
          }}
          styleOptions={choices(t, 'linkStyle', [
            'primary',
            'secondary',
            'link',
          ] as const)}
        />
      </FieldGroup>
    </div>
  );
}

type CustomContentData = z.infer<typeof customContentSection.schema>;

export function CustomContentEditor({
  data,
  onChange,
}: SectionEditorProps<CustomContentData>) {
  const t = useEditorTranslator();
  const mediaLabels = useMediaLabels();
  const richTextLabels = useRichTextLabels();

  return (
    <div className="space-y-4">
      <TextField
        label={t('editor.fields.title')}
        value={data.title}
        maxLength={120}
        onChange={(title) => onChange({ ...data, title }, 'title')}
      />

      {/*
        Ovde bi „ubaci svoj HTML" bio najlakše rešenje i najveća rupa. Umesto
        toga korisnik slaže blokove koje mi renderujemo - u pozivnicu zato ne
        može da uđe ni tuđi skript ni proizvoljna oznaka (zahtev 9).
      */}
      <RichTextField
        value={data.content}
        labels={richTextLabels}
        onChange={(content) => onChange({ ...data, content }, 'content')}
      />

      <MediaField
        label={t('editor.fields.image')}
        value={data.image}
        labels={mediaLabels}
        onChange={(image) => onChange({ ...data, image })}
      />

      <FieldGroup title={t('editor.fields.button')}>
        <ButtonField
          value={data.button}
          onChange={(button) => onChange({ ...data, button })}
          labels={{
            enabled: t('editor.fields.buttonEnabled'),
            label: t('editor.fields.buttonLabel'),
            url: t('editor.fields.buttonUrl'),
            style: t('editor.fields.buttonStyle'),
          }}
          styleOptions={choices(t, 'linkStyle', [
            'primary',
            'secondary',
            'link',
          ] as const)}
        />
      </FieldGroup>
    </div>
  );
}
