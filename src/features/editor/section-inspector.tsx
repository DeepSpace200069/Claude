'use client';

import { Suspense } from 'react';

import { Alert } from '@/components/ui/feedback';
import { getSectionDefinition } from '@/features/sections/registry';
import type { SectionEditorComponent } from '@/features/sections/types';
import { useTranslations } from '@/i18n/client';

import { getSectionEditor } from './editors';
import { findSection } from './document';
import { useEditorActions, useEditorDocument, useEditorState } from './store';

/**
 * Panel sa podešavanjima izabrane sekcije.
 *
 * Ne zna nijedan konkretan tip sekcije: uzme definiciju iz registra, editor iz
 * lenjog registra i prosledi im podatke. Zbog toga dodavanje nove sekcije ne
 * dira ovu komponentu (zahtev 39.1).
 */
export function SectionInspector() {
  const t = useTranslations();
  const document = useEditorDocument();
  const { selectedSectionId } = useEditorState();
  const actions = useEditorActions();

  const section = selectedSectionId ? findSection(document, selectedSectionId) : null;

  if (!section) {
    return (
      <p className="px-1 py-6 text-sm text-muted-foreground">
        {t('editor.inspector.empty')}
      </p>
    );
  }

  const definition = getSectionDefinition(section.type);
  const Editor = getSectionEditor(section.type);

  if (!definition || !Editor) {
    return (
      <Alert tone="warning" title={t('editor.inspector.unknownType')}>
        {t('editor.issues.skipped')}
      </Alert>
    );
  }

  return (
    <section aria-labelledby="inspektor-naslov" className="space-y-4">
      <header>
        <h2 id="inspektor-naslov" className="text-sm font-semibold">
          {t.dynamic(definition.labelKey)}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t.dynamic(definition.descriptionKey)}
        </p>
      </header>

      {/*
        Editor stiže lenjo (`next/dynamic`), pa mu treba granica učitavanja.
        Ključ je `section.id`: prelaskom na drugu sekciju komponenta se montira
        iznova, tako da unutrašnje stanje polja ne ostaje iz prethodne sekcije.
      */}
      <Suspense
        fallback={
          <p className="text-xs text-muted-foreground">{t('editor.inspector.loading')}</p>
        }
      >
        <EditorSlot
          key={section.id}
          component={Editor}
          data={section.data}
          onChange={(next, fieldPath) =>
            actions.updateData(section.id, next, fieldPath)
          }
        />
      </Suspense>
    </section>
  );
}

/**
 * Mesto na koje se ubacuje editor iz registra.
 *
 * Komponenta stiže kao prop, a ne kao promenljiva napravljena u toku
 * renderovanja: editori su modulske konstante (`next/dynamic`), pa se ne prave
 * iznova pri svakom prolazu. Ponovno montiranje je namerno i kontrolisano
 * `key`-em na pozivnom mestu - prelazak na drugu sekciju resetuje polja.
 */
function EditorSlot({
  component: Component,
  data,
  onChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tip podataka zavisi od sekcije; registar ga ne može znati unapred
  component: SectionEditorComponent<any>;
  data: unknown;
  onChange: (next: unknown, fieldPath?: string) => void;
}) {
  return <Component data={data} onChange={onChange} />;
}
