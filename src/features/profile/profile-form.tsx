'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import {
  updateProfileAction,
  type ProfileInput,
} from '@/server/actions/profile';
import { profileSchema } from '@/features/profile/schema';

/** Uređivanje profila i podešavanja obaveštenja. */
export function ProfileForm(props: {
  locale: Locale;
  messages: MessageTree;
  defaultValues: ProfileInput;
  email: string;
}) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <ProfileFormInner defaultValues={props.defaultValues} email={props.email} />
    </TranslationsProvider>
  );
}

function ProfileFormInner({
  defaultValues,
  email,
}: {
  defaultValues: ProfileInput;
  email: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const notificationOptions = [
    { value: 'immediate', label: t('profile.notifyImmediate') },
    { value: 'daily', label: t('profile.notifyDaily') },
    { value: 'weekly', label: t('profile.notifyWeekly') },
    { value: 'never', label: t('profile.notifyNever') },
  ] as const;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await updateProfileAction(values);

    if (result.ok) {
      toast.success(t('profile.saved'));
      form.reset(values);
      router.refresh();
      return;
    }

    setServerError(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError ? (
        <Alert tone="error" title={t('errors.genericTitle')}>
          {serverError}
        </Alert>
      ) : null}

      <Field
        label={t('profile.nameLabel')}
        error={form.formState.errors.name?.message}
        optionalLabel={t('common.optional')}
      >
        <FieldControl>
          {(controlProps) => (
            <Input {...controlProps} {...form.register('name')} autoComplete="name" />
          )}
        </FieldControl>
      </Field>

      <Field label={t('profile.emailLabel')} hint={t('profile.emailHint')}>
        <FieldControl>
          {(controlProps) => (
            <Input {...controlProps} value={email} readOnly disabled type="email" />
          )}
        </FieldControl>
      </Field>

      <Field label={t('profile.localeLabel')}>
        <FieldControl>
          {(controlProps) => (
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...controlProps}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {LOCALE_META[locale].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FieldControl>
      </Field>

      <Field
        label={t('profile.notificationsTitle')}
        hint={t('profile.notificationsSubtitle')}
      >
        <FieldControl>
          {(controlProps) => (
            <Controller
              control={form.control}
              name="rsvpNotifications"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...controlProps}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FieldControl>
      </Field>

      <Button
        type="submit"
        loading={form.formState.isSubmitting}
        disabled={!form.formState.isDirty}
      >
        {form.formState.isSubmitting ? t('common.saving') : t('common.save')}
      </Button>
    </form>
  );
}
