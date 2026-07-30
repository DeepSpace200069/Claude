'use client';

import { ArrowDown, ArrowUp, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  deleteQuestionAction,
  reorderQuestionsAction,
} from '@/server/actions/rsvp';

import { QuestionDialog } from './question-dialog';
import type { RsvpQuestion } from './types';

/**
 * Uređivanje dodatnih pitanja (zahtev 12).
 *
 * Redosled se menja strelicama, a ne prevlačenjem: lista je kratka, a strelice
 * rade i tastaturom i na telefonu bez ijedne dodatne biblioteke.
 */
export function QuestionManager({
  eventId,
  questions,
}: {
  eventId: string;
  questions: readonly RsvpQuestion[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [editing, setEditing] = useState<RsvpQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const move = async (index: number, direction: -1 | 1): Promise<void> => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;

    const ids = questions.map((question) => question.id);
    const moved = ids[index];
    const replaced = ids[target];
    if (!moved || !replaced) return;

    ids[index] = replaced;
    ids[target] = moved;

    setPending(true);
    const result = await reorderQuestionsAction({ eventId, questionIds: ids });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <ListPlus aria-hidden />
        {t('responses.addQuestion')}
      </Button>

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('responses.questionsEmpty')}</p>
      ) : (
        <ol className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {questions.map((question, index) => (
            <li
              key={question.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {question.label}
                  {question.isRequired ? (
                    <Badge variant="neutral" className="ml-2">
                      {t('common.required')}
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`responses.type${typeKey(question.type)}` as 'responses.typeText')}
                  {question.attendingOnly
                    ? ` · ${t('responses.questionAttendingOnly')}`
                    : ''}
                </p>
                {question.config.options && question.config.options.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.config.options.map((option) => option.label).join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending || index === 0}
                  onClick={() => void move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                  <span className="sr-only">{t('responses.moveUp')}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending || index === questions.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                  <span className="sr-only">{t('responses.moveDown')}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(question);
                    setOpen(true);
                  }}
                >
                  <Pencil aria-hidden />
                  <span className="sr-only">{t('responses.editQuestion')}</span>
                </Button>

                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Trash2 aria-hidden />
                      <span className="sr-only">{t('responses.deleteQuestion')}</span>
                    </Button>
                  }
                  title={t('responses.deleteQuestion')}
                  description={t('responses.deleteQuestionConfirm')}
                  confirmLabel={t('common.delete')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={async () => {
                    const result = await deleteQuestionAction({
                      eventId,
                      questionId: question.id,
                    });
                    if (!result.ok) return result.message;
                    router.refresh();
                    return null;
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <QuestionDialog
        key={editing?.id ?? 'novo'}
        eventId={eventId}
        question={editing}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

/** `single_choice` → `SingleChoice`, radi sastavljanja ključa prevoda. */
function typeKey(type: RsvpQuestion['type']): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
