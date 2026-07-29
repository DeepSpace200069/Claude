'use client';

import type { z } from 'zod';

import type {
  guestbookSection,
  rsvpSection,
} from '@/features/sections/definitions/interaction';
import type { SectionEditorProps } from '@/features/sections/types';

import {
  FieldGroup,
  NumberField,
  SwitchField,
  TextAreaField,
  TextField,
} from '../fields/basic';
import { useEditorTranslator } from './shared';

/** Editori sekcija kroz koje gost nešto radi (zahtev 9 i 12). */

type RsvpData = z.infer<typeof rsvpSection.schema>;

export function RsvpEditor({ data, onChange }: SectionEditorProps<RsvpData>) {
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
        label={t('editor.fields.intro')}
        value={data.intro}
        rows={3}
        onChange={(intro) => onChange({ ...data, intro }, 'intro')}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('editor.fields.deadline')}
          type="date"
          value={data.deadline ?? ''}
          onChange={(deadline) => onChange({ ...data, deadline: deadline || null })}
        />
        <TextField
          label={t('editor.fields.deadlineNote')}
          value={data.deadlineNote}
          maxLength={200}
          onChange={(deadlineNote) => onChange({ ...data, deadlineNote })}
        />
      </div>

      <FieldGroup title={t('editor.fields.content')}>
        <SwitchField
          label={t('editor.fields.allowMaybe')}
          checked={data.allowMaybe}
          onChange={(allowMaybe) => onChange({ ...data, allowMaybe })}
        />
        <SwitchField
          label={t('editor.fields.askChildren')}
          checked={data.askChildren}
          onChange={(askChildren) => onChange({ ...data, askChildren })}
        />
        <SwitchField
          label={t('editor.fields.askCompanionNames')}
          checked={data.askCompanionNames}
          onChange={(askCompanionNames) => onChange({ ...data, askCompanionNames })}
        />
        <SwitchField
          label={t('editor.fields.askMessage')}
          checked={data.askMessage}
          onChange={(askMessage) => onChange({ ...data, askMessage })}
        />
        <SwitchField
          label={t('editor.fields.askContact')}
          checked={data.askContact}
          onChange={(askContact) => onChange({ ...data, askContact })}
        />
      </FieldGroup>

      <TextAreaField
        label={t('editor.fields.confirmationMessage')}
        value={data.confirmationMessage}
        rows={3}
        onChange={(confirmationMessage) =>
          onChange({ ...data, confirmationMessage }, 'confirmationMessage')
        }
      />
    </div>
  );
}

type GuestbookData = z.infer<typeof guestbookSection.schema>;

export function GuestbookEditor({ data, onChange }: SectionEditorProps<GuestbookData>) {
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
        label={t('editor.fields.intro')}
        value={data.intro}
        rows={3}
        onChange={(intro) => onChange({ ...data, intro }, 'intro')}
      />

      {/*
        Odobravanje pre prikaza je podrazumevano uključeno: knjiga želja je
        javno polje za unos teksta, pa bez moderacije postaje otvoren kanal za
        neprimeren sadržaj na tuđoj proslavi (zahtev 9).
      */}
      <SwitchField
        label={t('editor.fields.requireApproval')}
        checked={data.requireApproval}
        onChange={(requireApproval) => onChange({ ...data, requireApproval })}
      />
      <SwitchField
        label={t('editor.fields.showPublicly')}
        checked={data.showPublicly}
        onChange={(showPublicly) => onChange({ ...data, showPublicly })}
      />
      <SwitchField
        label={t('editor.fields.allowReactions')}
        checked={data.allowReactions}
        onChange={(allowReactions) => onChange({ ...data, allowReactions })}
      />

      <NumberField
        label={t('editor.fields.maxMessageLength')}
        value={data.maxMessageLength}
        min={100}
        max={2000}
        step={50}
        onChange={(maxMessageLength) => onChange({ ...data, maxMessageLength })}
      />
    </div>
  );
}
