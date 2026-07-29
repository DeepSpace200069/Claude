'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, KeyRound, Link2, Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { updatePrivacyAction } from '@/server/actions/publishing';
import { cn } from '@/lib/utils';

import {
  INVITATION_PRIVACY,
  privacySettingsSchema,
  type InvitationPrivacy,
  type PrivacySettingsFormValues,
  type PrivacySettingsInput,
} from './schemas';

/**
 * Podešavanje ko sme da vidi pozivnicu (zahtev 23).
 *
 * Svaki režim ima objašnjenje uz sebe, a ne samo naziv: „samo sa linkom” i
 * „javno” zvuče slično, a razlika je u tome da li pozivnica završi u
 * pretraživaču. Podrazumevano stanje je uvek ono opreznije.
 */
const ICONS: Record<InvitationPrivacy, typeof Globe> = {
  public: Globe,
  unlisted: Link2,
  pin: KeyRound,
  invite_only: Lock,
};

export function PublishingForm({
  eventId,
  initial,
  hasPin,
}: {
  eventId: string;
  initial: {
    privacy: InvitationPrivacy;
    expiresOn: string;
    shareTitle: string;
    shareDescription: string;
  };
  hasPin: boolean;
}) {
  const t = useTranslations();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PrivacySettingsFormValues, unknown, PrivacySettingsInput>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: { eventId, pin: '', ...initial },
  });

  const privacy = useWatch({ control: form.control, name: 'privacy' });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await updatePrivacyAction(values);

    if (result.ok) {
      form.setValue('pin', '');
      toast.success(t('publishing.saved'));
      return;
    }

    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as keyof PrivacySettingsFormValues, {
          message: messages[0] ?? t('errors.genericText'),
        });
      }
    }
    setServerError(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError ? (
        <Alert tone="error" title={t('errors.genericTitle')}>
          {serverError}
        </Alert>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">
          {t('publishing.privacyTitle')}
        </legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {INVITATION_PRIVACY.map((mode) => {
            const Icon = ICONS[mode];
            const selected = privacy === mode;

            return (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-[var(--radius)] border p-3 transition-colors',
                  'focus-within:ring-2 focus-within:ring-ring/40',
                  selected ? 'border-primary bg-primary-subtle' : 'border-border bg-surface',
                )}
              >
                <input
                  type="radio"
                  value={mode}
                  className="sr-only"
                  {...form.register('privacy')}
                />
                <Icon
                  className={cn('mt-0.5 size-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
                  aria-hidden
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">
                    {t.dynamic(`publishing.privacy${capitalize(mode)}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.dynamic(`publishing.privacy${capitalize(mode)}Hint`)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {privacy === 'pin' ? (
        <Field
          label={t('publishing.pinLabel')}
          hint={hasPin ? `${t('publishing.pinSet')} ${t('publishing.pinHint')}` : t('publishing.pinHint')}
          error={form.formState.errors.pin?.message}
          required={!hasPin}
        >
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                {...form.register('pin')}
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
              />
            )}
          </FieldControl>
        </Field>
      ) : null}

      <Field
        label={t('publishing.expiresLabel')}
        hint={t('publishing.expiresHint')}
        optionalLabel={t('common.optional')}
        error={form.formState.errors.expiresOn?.message}
      >
        <FieldControl>
          {(controlProps) => (
            <Input {...controlProps} {...form.register('expiresOn')} type="date" />
          )}
        </FieldControl>
      </Field>

      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h3 className="text-sm font-semibold">{t('publishing.shareCardTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('publishing.shareCardHint')}</p>
        </div>

        <Field
          label={t('publishing.shareTitleLabel')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.shareTitle?.message}
        >
          <FieldControl>
            {(controlProps) => (
              <Input {...controlProps} {...form.register('shareTitle')} maxLength={120} />
            )}
          </FieldControl>
        </Field>

        <Field
          label={t('publishing.shareDescriptionLabel')}
          optionalLabel={t('common.optional')}
          error={form.formState.errors.shareDescription?.message}
        >
          <FieldControl>
            {(controlProps) => (
              <Textarea
                {...controlProps}
                {...form.register('shareDescription')}
                rows={3}
                maxLength={300}
              />
            )}
          </FieldControl>
        </Field>
      </section>

      <Button type="submit" loading={form.formState.isSubmitting}>
        {t('common.save')}
      </Button>
    </form>
  );
}

function capitalize(value: string): string {
  const camel = value.replace(/_(.)/g, (_, char: string) => char.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
