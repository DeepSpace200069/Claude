'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/toggles';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { createQuestionAction, updateQuestionAction } from '@/server/actions/rsvp';

import { RSVP_QUESTION_TYPES, type RsvpQuestion, type RsvpQuestionType } from './types';

type OptionDraft = { value: string; label: string };

/**
 * Unos jednog dodatnog pitanja.
 *
 * Polja se prilagođavaju tipu: opcije samo za izbore, granice samo za broj,
 * dužina samo za tekst. Prikazivanje svega odjednom bi organizatoru sugerisalo
 * da mora da popuni i ono što za njegov tip pitanja nema značenje.
 */
export function QuestionDialog({
  eventId,
  question,
  open,
  onOpenChange,
}: {
  eventId: string;
  question: RsvpQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [type, setType] = useState<RsvpQuestionType>(question?.type ?? 'single_choice');
  const [label, setLabel] = useState(question?.label ?? '');
  const [helpText, setHelpText] = useState(question?.helpText ?? '');
  const [isRequired, setIsRequired] = useState(question?.isRequired ?? false);
  const [attendingOnly, setAttendingOnly] = useState(question?.attendingOnly ?? true);
  const [options, setOptions] = useState<OptionDraft[]>(
    question?.config.options?.map((option) => ({ ...option })) ?? [
      { value: '', label: '' },
      { value: '', label: '' },
    ],
  );
  const [min, setMin] = useState(
    question?.config.min === undefined ? '' : String(question.config.min),
  );
  const [max, setMax] = useState(
    question?.config.max === undefined ? '' : String(question.config.max),
  );
  const [maxLength, setMaxLength] = useState(
    question?.config.maxLength === undefined ? '' : String(question.config.maxLength),
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const needsOptions = type === 'single_choice' || type === 'multi_choice';

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload = {
      eventId,
      question: {
        type,
        label,
        helpText,
        isRequired,
        attendingOnly,
        options: needsOptions
          ? options.filter((option) => option.label.trim() !== '')
          : [],
        min: type === 'number' ? min : '',
        max: type === 'number' ? max : '',
        maxLength: type === 'text' ? maxLength : '',
      },
    };

    const result = question
      ? await updateQuestionAction({ ...payload, questionId: question.id })
      : await createQuestionAction(payload);

    setPending(false);

    if (!result.ok) {
      setError(
        result.fieldErrors?.['question.options']?.[0] ??
          result.fieldErrors?.['question.label']?.[0] ??
          result.message,
      );
      return;
    }

    toast.success(t('common.saved'));
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {question ? t('responses.editQuestion') : t('responses.addQuestion')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label={t('responses.questionLabel')} required>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  autoComplete="off"
                />
              )}
            </FieldControl>
          </Field>

          <Field label={t('responses.questionType')}>
            <FieldControl>
              {(props) => (
                <select
                  {...props}
                  value={type}
                  onChange={(event) => setType(event.target.value as RsvpQuestionType)}
                  className="h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm"
                >
                  {RSVP_QUESTION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`responses.type${typeKey(value)}` as 'responses.typeText')}
                    </option>
                  ))}
                </select>
              )}
            </FieldControl>
          </Field>

          <Field
            label={t('responses.questionHelp')}
            optionalLabel={t('common.optional')}
          >
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  value={helpText}
                  onChange={(event) => setHelpText(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          {needsOptions ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t('responses.questionOptions')}
              </legend>

              {options.map((option, index) => (
                <div key={`opcija-${index}`} className="flex gap-2">
                  <Input
                    value={option.label}
                    aria-label={`${t('responses.questionOptions')} ${index + 1}`}
                    onChange={(event) =>
                      setOptions(
                        options.map((current, position) =>
                          position === index
                            ? { ...current, label: event.target.value }
                            : current,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setOptions(options.filter((_, position) => position !== index))
                    }
                  >
                    <X aria-hidden />
                    <span className="sr-only">{t('responses.removeOption')}</span>
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOptions([...options, { value: '', label: '' }])}
              >
                <Plus aria-hidden />
                {t('responses.addOption')}
              </Button>
            </fieldset>
          ) : null}

          {type === 'number' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('responses.questionMin')}
                optionalLabel={t('common.optional')}
              >
                <FieldControl>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      value={min}
                      onChange={(event) => setMin(event.target.value)}
                    />
                  )}
                </FieldControl>
              </Field>

              <Field
                label={t('responses.questionMax')}
                optionalLabel={t('common.optional')}
              >
                <FieldControl>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      value={max}
                      onChange={(event) => setMax(event.target.value)}
                    />
                  )}
                </FieldControl>
              </Field>
            </div>
          ) : null}

          {type === 'text' ? (
            <Field
              label={t('responses.questionMaxLength')}
              optionalLabel={t('common.optional')}
            >
              <FieldControl>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={10}
                    max={2000}
                    value={maxLength}
                    onChange={(event) => setMaxLength(event.target.value)}
                  />
                )}
              </FieldControl>
            </Field>
          ) : null}

          <label className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(checked === true)}
            />
            {t('responses.questionRequired')}
          </label>

          <label className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={attendingOnly}
              onCheckedChange={(checked) => setAttendingOnly(checked === true)}
            />
            {t('responses.questionAttendingOnly')}
          </label>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function typeKey(type: RsvpQuestionType): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
