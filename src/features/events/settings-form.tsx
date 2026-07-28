'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import { updateEventAction } from '@/server/actions/events';

import { DETAIL_FIELDS, type DetailField } from './details';
import {
  updateEventSchema,
  type UpdateEventFormValues,
  type UpdateEventInput,
} from './schemas';

/** Izmena osnovnih podataka događaja. */
export function EventSettingsForm(props: {
  locale: Locale;
  messages: MessageTree;
  detailFields: string[];
  defaultValues: UpdateEventFormValues;
}) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <SettingsFormInner
        detailFields={props.detailFields}
        defaultValues={props.defaultValues}
      />
    </TranslationsProvider>
  );
}

function SettingsFormInner({
  detailFields,
  defaultValues,
}: {
  detailFields: string[];
  defaultValues: UpdateEventFormValues;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateEventFormValues, unknown, UpdateEventInput>({
    resolver: zodResolver(updateEventSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await updateEventAction(values);

    if (result.ok) {
      toast.success(t('events.updated'));
      // Reset sa novim vrednostima gasi "nesačuvane izmene" stanje forme.
      form.reset(values);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as keyof UpdateEventFormValues, {
          message: messages[0] ?? t('errors.genericText'),
        });
      }
    }
    setServerError(result.message);
  });

  const visibleDetailFields = detailFields.filter((field): field is DetailField =>
    (DETAIL_FIELDS as readonly string[]).includes(field),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError ? (
        <Alert tone="error" title={t('errors.genericTitle')}>
          {serverError}
        </Alert>
      ) : null}

      <Field
        label={t('eventFields.internalName')}
        hint={t('eventFields.internalNameHint')}
        error={form.formState.errors.name?.message}
        required
      >
        <FieldControl>
          {(controlProps) => <Input {...controlProps} {...form.register('name')} />}
        </FieldControl>
      </Field>

      {visibleDetailFields.map((field) => (
        <Field
          key={field}
          label={t.dynamic(DETAIL_FIELD_LABELS[field])}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.details?.[field]?.message as string | undefined}
        >
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                {...form.register(`details.${field}` as const, {
                  setValueAs: (value) =>
                    field === 'turningAge'
                      ? value === ''
                        ? undefined
                        : Number(value)
                      : value === ''
                        ? undefined
                        : value,
                })}
                type={
                  field === 'birthDate'
                    ? 'date'
                    : field === 'turningAge'
                      ? 'number'
                      : 'text'
                }
              />
            )}
          </FieldControl>
        </Field>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('eventFields.eventDate')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.date?.message}
        >
          <FieldControl>
            {(controlProps) => (
              <Input {...controlProps} {...form.register('date')} type="date" />
            )}
          </FieldControl>
        </Field>

        <Field
          label={t('eventFields.startTime')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.time?.message}
        >
          <FieldControl>
            {(controlProps) => (
              <Input {...controlProps} {...form.register('time')} type="time" />
            )}
          </FieldControl>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('eventFields.city')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.city?.message}
        >
          <FieldControl>
            {(controlProps) => <Input {...controlProps} {...form.register('city')} />}
          </FieldControl>
        </Field>

        <Field
          label={t('eventFields.venue')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.venueName?.message}
        >
          <FieldControl>
            {(controlProps) => (
              <Input {...controlProps} {...form.register('venueName')} />
            )}
          </FieldControl>
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          disabled={!form.formState.isDirty}
        >
          {form.formState.isSubmitting ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

const DETAIL_FIELD_LABELS: Record<DetailField, string> = {
  partner1Name: 'eventFields.partner1',
  partner2Name: 'eventFields.partner2',
  celebrantName: 'eventFields.celebrant',
  childName: 'eventFields.childName',
  parentNames: 'eventFields.parentNames',
  birthDate: 'eventFields.birthDate',
  turningAge: 'eventFields.turningAge',
  hostNames: 'eventFields.partner1',
  note: 'eventFields.internalName',
};
