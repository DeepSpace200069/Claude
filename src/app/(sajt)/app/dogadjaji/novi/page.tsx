import { CreateEventWizard } from '@/features/events/create-wizard';
import type { WizardTemplate } from '@/features/events/template-picker';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { loadMessages } from '@/i18n/messages';
import { requireUserPage } from '@/server/authz/page-guards';
import { listActiveEventTypes } from '@/server/services/catalog';
import { listTemplates } from '@/server/services/templates';

/**
 * Čarobnjak za novu pozivnicu (zahtev 7).
 *
 * Tri koraka: vrsta proslave, osnovni podaci i izbor šablona. Šabloni se
 * učitavaju odjednom (ima ih desetak) i prosleđuju čarobnjaku, pa prelazak
 * između koraka ne čeka mrežu.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ sablon?: string }>;
}) {
  await requireUserPage('/app/dogadjaji/novi');

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const [eventTypes, templates] = await Promise.all([
    listActiveEventTypes(),
    listTemplates(),
  ]);

  const { sablon } = await searchParams;

  // U čarobnjak šaljemo samo ono što minijatura stvarno koristi, ne ceo objekat
  // teme - manje podataka pređe granicu server/klijent.
  const wizardTemplates: WizardTemplate[] = templates.map((template) => ({
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    eventTypeKey: template.eventTypeKey,
    requiredPlanCode: template.requiredPlanCode,
    isFeatured: template.isFeatured,
    background: template.themeTokens.palette.background,
    text: template.themeTokens.palette.text,
    textMuted: template.themeTokens.palette.textMuted,
    accent: template.themeTokens.palette.accent,
    accentContrast: template.themeTokens.palette.accentContrast,
    border: template.themeTokens.palette.border,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t('wizard.title')}
      </h1>

      <CreateEventWizard
        locale={locale}
        messages={{
          wizard: messages.wizard,
          eventFields: messages.eventFields,
          eventTypes: messages.eventTypes,
          templates: messages.templates,
          plans: messages.plans,
          common: messages.common,
          validation: messages.validation,
          errors: messages.errors,
          events: messages.events,
        }}
        eventTypes={eventTypes.map((type) => ({
          id: type.id,
          key: type.key,
          labelKey: type.labelKey,
          detailFields: type.detailFields,
        }))}
        templates={wizardTemplates}
        {...(sablon ? { preselectedTemplateSlug: sablon } : {})}
      />
    </div>
  );
}
