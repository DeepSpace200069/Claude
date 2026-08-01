import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AdminActionButton } from '@/features/admin/admin-controls';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireAdmin } from '@/server/authz';
import {
  publishTemplateVersionAction,
  setTemplateStatusAction,
} from '@/server/actions/admin';
import { listTemplatesForAdmin } from '@/server/services/admin';

/**
 * Šabloni: nacrt → objavljena verzija → arhiviranje (zahtev 7.6).
 *
 * Objavljivanje nove verzije ne menja postojeće pozivnice - one nose svoj
 * snimak sekcija. Menja se samo ono od čega kreću nove.
 */
export default async function AdminTemplatesPage() {
  await requireAdmin();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const templates = await listTemplatesForAdmin();

  const statusLabels = {
    draft: t('admin.statusDraft'),
    published: t('admin.statusPublished'),
    archived: t('admin.statusArchived'),
  };

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        admin: messages.admin,
        common: messages.common,
        errors: messages.errors,
      }}
    >
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t('admin.templatesTitle')}
          </h1>
        </header>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.templatesEmpty')}</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {templates.map((template) => (
                  <li key={template.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium">{template.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {template.slug} · {template.eventTypeKey} ·{' '}
                          {template.requiredPlanCode}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t('admin.templatesVersions', { count: template.versionCount })}
                          {template.kind === 'html' && template.draftFieldCount !== null
                            ? ` · ${t('admin.templatesDraftContents', {
                                fields: template.draftFieldCount,
                                assets: template.draftAssetCount ?? 0,
                              })}`
                            : null}
                        </span>
                      </span>

                      <span className="flex items-center gap-2">
                        {/*
                          Vrsta šablona stoji uz status: uvezen sajt se objavljuje
                          istim dugmetom, ali se pre toga proverava drugačije - ne
                          čitanjem sekcija nego gledanjem.
                        */}
                        <Badge variant="neutral">
                          {template.kind === 'html'
                            ? t('admin.templatesKindHtml')
                            : t('admin.templatesKindSections')}
                        </Badge>

                        <Badge
                          variant={
                            template.status === 'published'
                              ? 'success'
                              : template.status === 'draft'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {statusLabels[template.status]}
                        </Badge>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/*
                        Uvezen sajt se pre objavljivanja gleda, a ne čita. Bez
                        ovog linka bi jedini put do pregleda bio da se šablon
                        prvo objavi - dakle da u galeriju ode nešto što niko nije
                        video.
                      */}
                      {template.kind === 'html' && template.draftVersionId ? (
                        <a
                          href={`/nacrt-sajta/${template.draftVersionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {t('admin.templatesPreviewDraft')}
                        </a>
                      ) : null}

                      {template.draftVersionId ? (
                        <AdminActionButton
                          label={t('admin.templatesPublishDraft')}
                          successMessage={t('admin.templatesPublished')}
                          input={{
                            templateId: template.id,
                            versionId: template.draftVersionId,
                          }}
                          action={publishTemplateVersionAction}
                          variant="primary"
                          confirm={{
                            title: t('admin.templatesPublishDraft'),
                            description: t('admin.templatesHint'),
                            cancelLabel: t('common.cancel'),
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('admin.templatesNoDraft')}
                        </span>
                      )}

                      {template.status === 'archived' ? (
                        <AdminActionButton
                          label={t('admin.templatesRestore')}
                          successMessage={t('admin.templatesStatusChanged')}
                          input={{ templateId: template.id, status: 'draft' }}
                          action={setTemplateStatusAction}
                        />
                      ) : (
                        <AdminActionButton
                          label={t('admin.templatesArchive')}
                          successMessage={t('admin.templatesStatusChanged')}
                          input={{ templateId: template.id, status: 'archived' }}
                          action={setTemplateStatusAction}
                        />
                      )}

                      {template.status !== 'published' && template.publishedVersionId ? (
                        <AdminActionButton
                          label={t('admin.templatesPublish')}
                          successMessage={t('admin.templatesStatusChanged')}
                          input={{ templateId: template.id, status: 'published' }}
                          action={setTemplateStatusAction}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </TranslationsProvider>
  );
}
