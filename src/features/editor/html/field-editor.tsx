'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { templateAssetUrl } from '@/lib/html-template/assets';
import type {
  FieldDefinitions,
  FieldValues,
} from '@/features/templates/html-schema';
import type { ValueResolution } from '@/features/templates/html-values';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import { cn } from '@/lib/utils';
import { loadRevisionFieldsAction } from '@/server/actions/invitations';
import type { MediaAsset } from '@/server/services/media';

import { EditorConfigProvider, type EditorConfig } from '../context';
import { EditorTabBar, useTabIds, type EditorTab } from '../editor-tabs';
import {
  ConflictDialogView,
  RevisionsDialog,
  SaveIndicator,
} from '../save-status';
import type { TemplateOption } from '../template-switcher';
import { useUnsavedChangesWarning } from '../use-autosave';
import { FieldForm } from './field-form';
import { HtmlPreview } from './preview';
import {
  FieldEditorProvider,
  useFieldEditorDispatch,
  useFieldEditorState,
  useIsFieldEditorDirty,
} from './store';
import { HtmlTemplateSwitcher } from './template-switcher';
import { useFieldAutosave } from './use-field-autosave';

/**
 * Uređivač pozivnice napravljene od uvezenog sajta (zahtev 39.4).
 *
 * Isti okvir kao uređivač sekcija - ista traka sa stanjem čuvanja, ista
 * istorija verzija, isto razrešavanje sudara - ali sasvim drugi centralni deo.
 * Ovde nema liste sekcija, biblioteke ni teme, jer se ništa od toga ne menja:
 * raspored, boje i animacije su autorove i ostaju kakve jesu. Menja se sadržaj,
 * i to kroz običnu formu.
 *
 * Dve kolone na širokom ekranu, dva taba na telefonu - kao i kod sekcija,
 * jednim stablom, gde širinu rešava CSS.
 */
export type FieldEditorPageData = {
  locale: Locale;
  messages: MessageTree;
  config: EditorConfig;
  eventName: string;
  revision: number;
  media: MediaAsset[];
  /** Dokument šablona sa tokenima; popunjava se u pregledaču. */
  document: string;
  definitions: FieldDefinitions;
  values: FieldValues;
  templateVersionId: string;
  templateId: string | null;
  templates: TemplateOption[];
};

export function FieldEditorApp(props: FieldEditorPageData) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <EditorConfigProvider config={props.config}>
        <FieldEditorProvider
          definitions={props.definitions}
          values={props.values}
          revision={props.revision}
          media={props.media}
        >
          <FieldEditorShell {...props} />
        </FieldEditorProvider>
      </EditorConfigProvider>
    </TranslationsProvider>
  );
}

function FieldEditorShell(props: FieldEditorPageData) {
  const t = useTranslations();
  const state = useFieldEditorState();
  const dispatch = useFieldEditorDispatch();
  const autosave = useFieldAutosave(props.config.eventId);
  const dirty = useIsFieldEditorDirty();
  const [tab, setTab] = useState<EditorTab>('sadrzaj');
  const [previewKey, setPreviewKey] = useState(0);
  const panelId = useTabIds();

  useUnsavedChangesWarning(dirty || state.save.status === 'error');

  /**
   * Razrešavanje vrednosti u adrese.
   *
   * Fotografije se čuvaju kao ključ, a slike šablona kao putanja; pregled i
   * forma treba da vide URL. Karta se pravi iz spiska fotografija u stanju, pa
   * novoootpremljena slika radi odmah, bez ponovnog učitavanja stranice.
   */
  const resolution: ValueResolution = useMemo(() => {
    const byId = new Map(state.media.map((asset) => [asset.id, asset.url]));

    return {
      assetUrl: (path) => templateAssetUrl(props.templateVersionId, path),
      mediaUrl: (assetId) => byId.get(assetId) ?? null,
    };
  }, [state.media, props.templateVersionId]);

  const restoreRevision = useCallback(
    async (revisionId: string): Promise<boolean> => {
      const result = await loadRevisionFieldsAction({
        eventId: props.config.eventId,
        revisionId,
      });

      if (!result.ok) {
        toast.error(result.message);
        return false;
      }

      dispatch({ kind: 'replace', values: result.data.values });
      setPreviewKey((key) => key + 1);
      toast.success(t('editor.history.restored'));
      return true;
    },
    [dispatch, props.config.eventId, t],
  );

  const tabs = [
    { value: 'sadrzaj' as const, label: t('editor.tabContent') },
    { value: 'pregled' as const, label: t('editor.tabPreview'), hideOnWide: true },
  ];

  const panelClass = (visible: boolean) =>
    cn('min-h-0 overflow-y-auto p-4', visible ? 'block' : 'hidden', 'lg:block');

  return (
    <div className="flex min-h-[38rem] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface lg:h-[calc(100svh-9rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/app/dogadjaji/${props.config.eventId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t('editor.backToEvent')}</span>
          </Link>
          <span className="truncate text-sm font-medium">{props.eventName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <SaveIndicator
            status={state.save.status}
            savedAt={state.save.savedAt}
            message={state.save.message}
            isDirty={dirty}
          />

          <RevisionsDialog
            eventId={props.config.eventId}
            onRestore={restoreRevision}
          />

          {state.save.status === 'error' ? (
            <Button type="button" size="sm" onClick={() => void autosave.saveNow()}>
              {t('editor.save.retry')}
            </Button>
          ) : null}
        </div>

        <ConflictDialogView
          open={state.save.status === 'conflict'}
          onKeepMine={() => autosave.saveNow({ baseRevision: state.revision })}
        />
      </header>

      <div className="border-b border-border px-4 py-2">
        <EditorTabBar
          tabs={tabs}
          value={tab}
          onChange={setTab}
          label={t('editor.title')}
          panelId={panelId}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[24rem_1fr]">
        <aside
          id={panelId('sadrzaj')}
          role="tabpanel"
          aria-labelledby={`${panelId('sadrzaj')}-tab`}
          className={cn(panelClass(tab === 'sadrzaj'), 'space-y-6 lg:border-r lg:border-border')}
        >
          <Alert tone="info" title={t('editor.html.title')}>
            {t('editor.html.intro')}
          </Alert>

          <FieldForm resolution={resolution} />

          <HtmlTemplateSwitcher
            templates={props.templates}
            currentTemplateId={props.templateId}
            onSwitched={() => setPreviewKey((key) => key + 1)}
          />
        </aside>

        <main
          id={panelId('pregled')}
          role="tabpanel"
          aria-labelledby={`${panelId('pregled')}-tab`}
          className={panelClass(tab === 'pregled')}
        >
          {/*
            `key` gasi i pravi novi `<iframe>`: posle vraćene verzije ili promene
            šablona pregled mora da krene ispočetka, jer su se promenile i
            vrednosti u skripti, a ne samo tekst na ekranu.
          */}
          <HtmlPreview
            key={previewKey}
            document={props.document}
            definitions={state.definitions}
            values={state.values}
            resolution={resolution}
          />
        </main>
      </div>
    </div>
  );
}
