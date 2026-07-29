'use client';

import { LayoutTemplate } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { switchTemplateAction } from '@/server/actions/invitations';
import { cn } from '@/lib/utils';

import { useEditorConfig } from './context';
import { useEditorDispatch, useEditorDocument, useEditorState } from './store';

/**
 * Promena šablona bez gubitka unetog sadržaja (zahtev 3.12).
 *
 * Spajanje radi server, istom funkcijom koju pokrivaju testovi
 * (`applyTemplateToDocument`): šablon donosi raspored i boje, korisnikov tekst
 * ostaje, a sekcije koje novi šablon nema premeštaju se na kraj umesto da nestanu.
 *
 * Rezultat se odmah upisuje - promena šablona je krupna izmena i ne bi bilo
 * dobro da postoji samo u pregledaču dok autosave ne stigne.
 */
export type TemplateOption = {
  id: string;
  name: string;
  description: string;
  style: string;
};

export function TemplateSwitcher({
  templates,
  currentTemplateId,
}: {
  templates: TemplateOption[];
  currentTemplateId: string | null;
}) {
  const t = useTranslations();
  const config = useEditorConfig();
  const document = useEditorDocument();
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = templates.find((template) => template.id === currentTemplateId);

  const apply = async (templateId: string | null) => {
    setBusy(true);

    const result = await switchTemplateAction({
      eventId: config.eventId,
      baseRevision: state.revision,
      templateId,
      theme: document.theme,
      sections: document.sections,
    });

    setBusy(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    dispatch({
      kind: 'serverReload',
      document: result.data.document,
      revision: result.data.revision,
    });
    setOpen(false);
    toast.success(t('editor.template.changed'));
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('editor.template.title')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {current
          ? t('editor.template.current', { name: current.name })
          : t('editor.template.none')}
      </p>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <LayoutTemplate aria-hidden />
        {t('editor.template.change')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('editor.template.changeTitle')}</DialogTitle>
            <DialogDescription>
              {t('editor.template.changeDescription')}
            </DialogDescription>
          </DialogHeader>

          <ul className="grid gap-2 sm:grid-cols-2">
            <li>
              <TemplateChoice
                title={t('editor.template.emptyOption')}
                description={t('editor.template.emptyOptionHint')}
                selected={currentTemplateId === null}
                disabled={busy}
                onSelect={() => void apply(null)}
              />
            </li>
            {templates.map((template) => (
              <li key={template.id}>
                <TemplateChoice
                  title={template.name}
                  description={template.description}
                  selected={template.id === currentTemplateId}
                  disabled={busy}
                  onSelect={() => void apply(template.id)}
                />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TemplateChoice({
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full flex-col gap-1 rounded-[var(--radius)] border p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:opacity-60',
        selected ? 'border-primary bg-primary-subtle' : 'border-border bg-surface hover:border-primary',
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
