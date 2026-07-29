'use client';

import { useState } from 'react';

import { Alert } from '@/components/ui/feedback';
import type { InvitationRenderContext } from '@/features/sections/types';
import type { ThemeTokens } from '@/features/themes/tokens';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import type { MediaAsset } from '@/server/services/media';

import { cn } from '@/lib/utils';

import { EditorConfigProvider, type EditorConfig } from './context';
import type { EditorDocument } from './document';
import { EditorTabBar, useTabIds, type EditorTab } from './editor-tabs';
import { EditorToolbar } from './editor-toolbar';
import { PreviewPanel } from './preview-panel';
import { SectionInspector } from './section-inspector';
import { SectionLibrary } from './section-library';
import { SectionList } from './section-list';
import { EditorStateProvider, useEditorDocument, useEditorState, useIsDirty } from './store';
import { TemplateSwitcher, type TemplateOption } from './template-switcher';
import { ThemePanel } from './theme-panel';
import { useAutosave, useUnsavedChangesWarning } from './use-autosave';

/**
 * Raspored uređivača (zahtev 3.13).
 *
 * Na širokom ekranu stoje tri kolone: sekcije, podešavanja izabrane sekcije i
 * živi pregled. Na telefonu tri kolone ne staju, pa isti paneli postaju tabovi -
 * bez „mobilne verzije" u kojoj neka radnja nedostaje.
 *
 * Isti paneli, a ne dva rasporeda: renderuje se **jedno** stablo, a širina
 * ekrana menja samo CSS. Dva stabla bi značila dve kopije svakog polja u DOM-u,
 * a prebacivanje stabla posle hidracije ume da ostavi i nevidljive ostatke
 * prethodnog rasporeda.
 */
export type EditorPageData = {
  locale: Locale;
  messages: MessageTree;
  config: EditorConfig;
  document: EditorDocument;
  revision: number;
  media: MediaAsset[];
  eventName: string;
  eventTypeKey: string;
  renderContext: Omit<InvitationRenderContext, 'media'>;
  templateTheme: ThemeTokens | null;
  templateId: string | null;
  templates: TemplateOption[];
  issues: Array<{ sectionId: string; message: string }>;
};

export function EditorApp(props: EditorPageData) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <EditorConfigProvider config={props.config}>
        <EditorStateProvider
          document={props.document}
          revision={props.revision}
          media={props.media}
        >
          <EditorShell {...props} />
        </EditorStateProvider>
      </EditorConfigProvider>
    </TranslationsProvider>
  );
}

function EditorShell(props: EditorPageData) {
  const t = useTranslations();
  const autosave = useAutosave(props.config.eventId);
  const state = useEditorState();
  const isDirty = useIsDirty();
  const [tab, setTab] = useState<EditorTab>('sadrzaj');
  const panelId = useTabIds();

  // Upozorenje pri napuštanju stranice ima smisla samo dok izmene zaista nisu
  // na serveru; autosave ih obično sačuva pre nego što korisnik ode.
  useUnsavedChangesWarning(isDirty || state.save.status === 'error');

  const inspectorId = `${panelId('sadrzaj')}-inspektor`;

  const tabs = [
    {
      value: 'sadrzaj' as const,
      label: t('editor.tabContent'),
      controls: `${panelId('sadrzaj')} ${inspectorId}`,
    },
    { value: 'izgled' as const, label: t('editor.tabDesign') },
    // Na širokom ekranu je pregled uvek uz uređivač, pa tab nema šta da radi.
    { value: 'pregled' as const, label: t('editor.tabPreview'), hideOnWide: true },
  ];

  /*
   * Vidljivost panela je isključivo CSS.
   *
   * Struktura je ista na serveru i na klijentu - nema medijskog upita koji bi
   * posle hidracije promenio oblik stabla, pa ni ostataka starog rasporeda u
   * DOM-u. `display: none` uklanja panel i sa ekrana i iz stabla pristupačnosti,
   * tako da čitač ekrana nikad ne naiđe na dve kontrole sa istim nazivom.
   */
  const panelClass = (visible: boolean, alwaysWide: boolean) =>
    cn(
      'min-h-0 overflow-y-auto p-4',
      visible ? 'block' : 'hidden',
      alwaysWide && 'lg:block',
    );

  return (
    /*
     * Uređivač živi unutar okvira aplikacije, pa zadržava navigaciju i prebacivanje
     * jezika. Visina je vezana za visinu prozora da bi kolone imale svoje
     * skrolovanje umesto da se cela stranica pomera pri svakoj izmeni.
     */
    <div className="flex min-h-[38rem] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface lg:h-[calc(100svh-9rem)]">
      <EditorToolbar eventName={props.eventName} autosave={autosave} />

      <div className="border-b border-border px-4 py-2">
        <EditorTabBar
          tabs={tabs}
          value={tab}
          onChange={setTab}
          label={t('editor.title')}
          panelId={panelId}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[19rem_21rem_1fr]">
        <aside
          id={panelId('sadrzaj')}
          role="tabpanel"
          aria-labelledby={`${panelId('sadrzaj')}-tab`}
          className={cn(
            panelClass(tab === 'sadrzaj', true),
            'lg:border-r lg:border-border',
          )}
        >
          <SectionsColumn issues={props.issues} eventTypeKey={props.eventTypeKey} />
        </aside>

        {/*
          Podešavanja sekcije i izgled dele istu kolonu: na širokom ekranu se
          smenjuju istim tabom kojim se na telefonu smenjuju ekrani.
        */}
        <div
          id={inspectorId}
          role="tabpanel"
          aria-labelledby={`${panelId('sadrzaj')}-tab`}
          className={cn(
            panelClass(tab === 'sadrzaj', tab !== 'izgled'),
            'lg:border-r lg:border-border',
          )}
        >
          <SectionInspector />
        </div>

        <div
          id={panelId('izgled')}
          role="tabpanel"
          aria-labelledby={`${panelId('izgled')}-tab`}
          className={cn(
            panelClass(tab === 'izgled', false),
            'space-y-6 lg:border-r lg:border-border',
          )}
        >
          <TemplateSwitcher
            templates={props.templates}
            currentTemplateId={props.templateId}
          />
          <ThemePanel templateTheme={props.templateTheme} />
        </div>

        <main
          id={panelId('pregled')}
          role="tabpanel"
          aria-labelledby={`${panelId('pregled')}-tab`}
          className={panelClass(tab === 'pregled', true)}
        >
          <PreviewPanel context={props.renderContext} />
        </main>
      </div>
    </div>
  );
}

function SectionsColumn({
  issues,
  eventTypeKey,
}: {
  issues: Array<{ sectionId: string; message: string }>;
  eventTypeKey: string;
}) {
  const t = useTranslations();
  const document = useEditorDocument();

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('editor.sections.title')}</h2>
        <span className="text-xs text-muted-foreground">
          {t('editor.sections.countLabel', { count: document.sections.length })}
        </span>
      </div>

      {issues.length > 0 ? (
        <Alert tone="warning" title={t('editor.issues.title')}>
          <ul className="list-disc space-y-1 pl-4">
            {issues.map((issue) => (
              <li key={issue.sectionId}>{issue.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <SectionList />
      <SectionLibrary eventTypeKey={eventTypeKey} />
    </div>
  );
}
