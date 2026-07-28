import { CreateEventWizard } from '@/features/events/create-wizard';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { loadMessages } from '@/i18n/messages';
import { requireUserPage } from '@/server/authz/page-guards';
import { listActiveEventTypes } from '@/server/services/catalog';

/**
 * Čarobnjak za novu pozivnicu (zahtev 7).
 *
 * Koraci 1 i 2 (vrsta proslave i osnovni podaci) prave nacrt; izbor šablona
 * (korak 3) dolazi u Fazi 2, a uređivač u Fazi 3 - nacrt je već upotrebljiv i
 * bez njih, pa korisnik nikad ne ostane u polovičnom stanju.
 */
export default async function NewEventPage() {
  await requireUserPage('/app/dogadjaji/novi');

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const eventTypes = await listActiveEventTypes();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('wizard.title')}
      </h1>

      <CreateEventWizard
        locale={locale}
        messages={{
          wizard: messages.wizard,
          eventFields: messages.eventFields,
          eventTypes: messages.eventTypes,
          common: messages.common,
          validation: messages.validation,
          errors: messages.errors,
        }}
        eventTypes={eventTypes.map((type) => ({
          id: type.id,
          key: type.key,
          labelKey: type.labelKey,
          detailFields: type.detailFields,
        }))}
      />
    </div>
  );
}
