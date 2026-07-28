'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import { createEventAction } from '@/server/actions/events';

import { DETAIL_FIELDS, type DetailField } from './details';
import {
  createEventSchema,
  type CreateEventFormValues,
  type CreateEventInput,
} from './schemas';

type EventTypeOption = {
  id: string;
  key: string;
  labelKey: string;
  detailFields: string[];
};

const TOTAL_STEPS = 2;

export function CreateEventWizard(props: {
  locale: Locale;
  messages: MessageTree;
  eventTypes: EventTypeOption[];
}) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <WizardInner eventTypes={props.eventTypes} />
    </TranslationsProvider>
  );
}

function WizardInner({ eventTypes }: { eventTypes: EventTypeOption[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateEventFormValues, unknown, CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      eventTypeId: '',
      name: '',
      details: {},
      date: '',
      time: '',
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Belgrade',
      city: '',
      venueName: '',
      primaryLocale: 'sr-Latn',
    },
  });

  // useWatch umesto form.watch(): vraća vrednost, a ne funkciju, pa React
  // Compiler može da memoizuje komponentu.
  const selectedTypeId = useWatch({ control: form.control, name: 'eventTypeId' });
  const selectedType = eventTypes.find((type) => type.id === selectedTypeId);

  const goToDetails = async () => {
    const valid = await form.trigger('eventTypeId');
    if (valid) setStep(2);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await createEventAction(values);

    if (result.ok) {
      toast.success(t('events.created'));
      router.push(`/app/dogadjaji/${result.data.eventId}`);
      return;
    }

    // Greške po poljima vraćamo formi da bi se prikazale uz odgovarajući unos.
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as keyof CreateEventFormValues, {
          message: messages[0] ?? t('errors.genericText'),
        });
      }
    }

    setServerError(result.message);
  });

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('wizard.stepOf', { current: step, total: TOTAL_STEPS })}
      </p>

      {serverError ? (
        <Alert tone="error" title={t('errors.genericTitle')}>
          {serverError}
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        {step === 1 ? (
          <section aria-labelledby="korak-1">
            <h2 id="korak-1" className="font-display text-2xl font-semibold">
              {t('wizard.step1Title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('wizard.step1Subtitle')}
            </p>

            <fieldset className="mt-6">
              <legend className="sr-only">{t('wizard.step1Title')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {eventTypes.map((type) => (
                  <label
                    key={type.id}
                    className="cursor-pointer"
                    data-selected={selectedTypeId === type.id}
                  >
                    <input
                      type="radio"
                      value={type.id}
                      className="peer sr-only"
                      {...form.register('eventTypeId')}
                    />
                    <Card className="h-full transition-all peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-ring/30 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      <CardContent className="flex items-center justify-between gap-3 p-5 pt-5">
                        <span className="font-medium">
                          {t.dynamic(type.labelKey)}
                        </span>
                        <Check
                          className="size-4 text-primary opacity-0 peer-checked:opacity-100"
                          aria-hidden
                        />
                      </CardContent>
                    </Card>
                  </label>
                ))}
              </div>

              {form.formState.errors.eventTypeId ? (
                <p className="mt-2 text-xs font-medium text-destructive">
                  {form.formState.errors.eventTypeId.message}
                </p>
              ) : null}
            </fieldset>

            <div className="mt-8 flex justify-end">
              <Button type="button" onClick={goToDetails}>
                {t('common.next')}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="korak-2" className="space-y-5">
            <div>
              <h2 id="korak-2" className="font-display text-2xl font-semibold">
                {t('wizard.step2Title')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('wizard.step2Subtitle')}
              </p>
            </div>

            {/* Polja zavise od izabranog tipa proslave (zahtev 7, korak 2). */}
            {(selectedType?.detailFields ?? []).filter(isDetailField).map((field) => (
              <Field
                key={field}
                label={t.dynamic(detailFieldLabelKey(field))}
                optionalLabel={t('common.optional')}
                error={
                  form.formState.errors.details?.[field]?.message as
                    | string
                    | undefined
                }
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
                      type={detailFieldInputType(field)}
                    />
                  )}
                </FieldControl>
              </Field>
            ))}

            <Field
              label={t('eventFields.internalName')}
              hint={t('eventFields.internalNameHint')}
              error={form.formState.errors.name?.message}
              required
            >
              <FieldControl>
                {(controlProps) => (
                  <Input {...controlProps} {...form.register('name')} />
                )}
              </FieldControl>
            </Field>

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
                  {(controlProps) => (
                    <Input {...controlProps} {...form.register('city')} />
                  )}
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

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft aria-hidden />
                {t('common.back')}
              </Button>

              <Button type="submit" loading={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t('wizard.creating')
                  : t('wizard.createDraft')}
              </Button>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}

function isDetailField(value: string): value is DetailField {
  return (DETAIL_FIELDS as readonly string[]).includes(value);
}

/** Mapiranje polja na ključ prevoda; naziv polja nikad nije hardkodovan tekst. */
function detailFieldLabelKey(field: DetailField): string {
  const map: Record<DetailField, string> = {
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
  return map[field];
}

function detailFieldInputType(field: DetailField): string {
  if (field === 'birthDate') return 'date';
  if (field === 'turningAge') return 'number';
  return 'text';
}
