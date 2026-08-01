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
import { switchHtmlTemplateAction } from '@/server/actions/invitations';

import { useEditorConfig } from '../context';
import { TemplateChoice, type TemplateOption } from '../template-switcher';
import { useFieldEditorDispatch, useFieldEditorState } from './store';

/**
 * Promena HTML šablona (zahtev 39.4).
 *
 * Nude se samo drugi **gotovi sajtovi**, nikad šabloni od sekcija. Sadržaj se
 * između te dve vrste ne prenosi - polja i sekcije nemaju zajednički oblik - pa
 * bi takav prelazak bio tiho brisanje svega unetog. Vrsta se bira jednom, pri
 * pravljenju pozivnice.
 *
 * Unutar iste vrste važi isto pravilo kao kod sekcija: **ono što se poklapa,
 * ostaje.** Vrednost polja se prenosi za svaki ključ koji i novi šablon ima.
 */
export function HtmlTemplateSwitcher({
  templates,
  currentTemplateId,
  onSwitched,
}: {
  templates: TemplateOption[];
  currentTemplateId: string | null;
  /** Prikaz mora da se učita ispočetka - novi šablon je drugi dokument. */
  onSwitched: () => void;
}) {
  const t = useTranslations();
  const config = useEditorConfig();
  const state = useFieldEditorState();
  const dispatch = useFieldEditorDispatch();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = templates.find((template) => template.id === currentTemplateId);

  const apply = async (templateId: string) => {
    setBusy(true);

    const result = await switchHtmlTemplateAction({
      eventId: config.eventId,
      baseRevision: state.revision,
      templateId,
      values: state.values,
    });

    setBusy(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    dispatch({
      kind: 'replace',
      values: result.data.values,
      definitions: result.data.definitions,
    });
    dispatch({
      kind: 'saveSuccess',
      values: result.data.values,
      revision: result.data.revision,
      savedAt: Date.parse(result.data.savedAt),
    });

    setOpen(false);
    toast.success(t('editor.template.changed'));
    onSwitched();
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

      {templates.length <= 1 ? (
        <p className="text-xs text-muted-foreground">{t('editor.html.onlyTemplate')}</p>
      ) : (
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('editor.template.changeTitle')}</DialogTitle>
            <DialogDescription>{t('editor.html.changeDescription')}</DialogDescription>
          </DialogHeader>

          <ul className="grid gap-2 sm:grid-cols-2">
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
