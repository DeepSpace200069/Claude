'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/toggles';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { createGuestAction, updateGuestAction } from '@/server/actions/guests';

import {
  guestFormSchema,
  tagsFromText,
  type GuestFormOutput,
  type GuestFormValues,
} from './schemas';

export type GuestDialogHousehold = { id: string; name: string };

/**
 * Dodavanje i izmena gosta (zahtev 12).
 *
 * Obavezno je samo ime. Organizator često zna samo to - kontakt dolazi kasnije,
 * a ako ga natera forma, u spisku završe izmišljeni brojevi telefona.
 */
export function GuestDialog({
  eventId,
  households,
  open,
  onOpenChange,
  guest,
}: {
  eventId: string;
  households: readonly GuestDialogHousehold[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` znači novi gost. */
  guest: (GuestFormValues & { id: string }) | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<GuestFormValues, unknown, GuestFormOutput>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: guest ?? EMPTY_GUEST,
  });

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    const payload = {
      eventId,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      isChild: values.isChild,
      privateNote: values.privateNote,
      householdId: values.householdId,
      tags: tagsFromText(values.tagsText),
    };

    const result = guest
      ? await updateGuestAction({ ...payload, guestId: guest.id })
      : await createGuestAction(payload);

    if (result.ok) {
      toast.success(t('guests.saved'));
      form.reset(EMPTY_GUEST);
      onOpenChange(false);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field in EMPTY_GUEST) {
          form.setError(field as keyof GuestFormValues, {
            message: messages[0] ?? t('errors.genericText'),
          });
        }
      }
    }

    setServerError(result.message);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset(guest ?? EMPTY_GUEST);
          setServerError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {guest ? t('guests.editGuest') : t('guests.addGuest')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {serverError ? (
            <Alert tone="error" title={t('errors.genericTitle')}>
              {serverError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('guests.firstName')}
              required
              error={form.formState.errors.firstName?.message}
            >
              <FieldControl>
                {(props) => (
                  <Input {...props} {...form.register('firstName')} autoComplete="off" />
                )}
              </FieldControl>
            </Field>

            <Field
              label={t('guests.lastName')}
              optionalLabel={t('common.optional')}
              error={form.formState.errors.lastName?.message}
            >
              <FieldControl>
                {(props) => (
                  <Input {...props} {...form.register('lastName')} autoComplete="off" />
                )}
              </FieldControl>
            </Field>

            <Field
              label={t('guests.email')}
              optionalLabel={t('common.optional')}
              error={form.formState.errors.email?.message}
            >
              <FieldControl>
                {(props) => (
                  <Input {...props} type="email" {...form.register('email')} />
                )}
              </FieldControl>
            </Field>

            <Field
              label={t('guests.phone')}
              optionalLabel={t('common.optional')}
              error={form.formState.errors.phone?.message}
            >
              <FieldControl>
                {(props) => <Input {...props} type="tel" {...form.register('phone')} />}
              </FieldControl>
            </Field>
          </div>

          <Field
            label={t('guests.household')}
            optionalLabel={t('common.optional')}
            error={form.formState.errors.householdId?.message}
          >
            <FieldControl>
              {(props) => (
                <select
                  {...props}
                  {...form.register('householdId')}
                  className="h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm"
                >
                  <option value="">{t('guests.noHousehold')}</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>
              )}
            </FieldControl>
          </Field>

          <Field
            label={t('guests.tags')}
            hint={t('guests.tagsHint')}
            optionalLabel={t('common.optional')}
            error={form.formState.errors.tagsText?.message}
          >
            <FieldControl>
              {(props) => <Input {...props} {...form.register('tagsText')} />}
            </FieldControl>
          </Field>

          <Field
            label={t('guests.privateNote')}
            hint={t('guests.privateNoteHint')}
            optionalLabel={t('common.optional')}
            error={form.formState.errors.privateNote?.message}
          >
            <FieldControl>
              {(props) => <Textarea {...props} rows={3} {...form.register('privateNote')} />}
            </FieldControl>
          </Field>

          {/*
            `Controller`, a ne `form.watch`: `watch` vraća funkciju koju React
            Compiler ne ume da memoizuje, pa bi cela forma ispala iz
            optimizacije zbog jedne kućice.
          */}
          <Controller
            control={form.control}
            name="isChild"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                {t('guests.isChild')}
              </label>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_GUEST: GuestFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  isChild: false,
  privateNote: '',
  householdId: '',
  tagsText: '',
};
