'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';

import { requestMagicLinkAction, signInWithGoogleAction } from './actions';

const loginSchema = z.object({
  email: z.email('Unesite ispravnu email adresu.').max(160),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Forma za prijavu.
 *
 * Prima samo prostore imena `auth` i `common` umesto celog kataloga - stranica
 * prijave ne treba da nosi prevode kontrolnog panela (zahtev 32).
 */
export function LoginForm(props: {
  locale: Locale;
  messages: MessageTree;
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <LoginFormInner
        googleEnabled={props.googleEnabled}
        callbackUrl={props.callbackUrl}
      />
    </TranslationsProvider>
  );
}

function LoginFormInner({
  googleEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
}) {
  const t = useTranslations();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await requestMagicLinkAction({
      email: values.email,
      callbackUrl,
    });

    // Uspeh vodi na stranicu "proverite email" kroz preusmerenje sa servera;
    // ovde obrađujemo samo neuspeh.
    if (result && !result.ok) {
      setServerError(result.message);
    }
  });

  return (
    <div className="space-y-5">
      {serverError ? (
        <Alert tone="error" title={t('auth.errorTitle')}>
          {serverError}
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          label={t('auth.emailLabel')}
          error={form.formState.errors.email?.message}
          required
        >
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                {...form.register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder={t('auth.emailPlaceholder')}
              />
            )}
          </FieldControl>
        </Field>

        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          <Mail aria-hidden />
          {form.formState.isSubmitting
            ? t('auth.sendingMagicLink')
            : t('auth.sendMagicLink')}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              {t('auth.orContinueWith')}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form action={signInWithGoogleAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" variant="secondary" className="w-full">
              {t('auth.googleButton')}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
