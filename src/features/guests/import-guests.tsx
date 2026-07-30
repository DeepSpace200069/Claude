'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/toggles';
import { useTranslations } from '@/i18n/client';
import { importGuestsAction } from '@/server/actions/guests';

type ImportSummary = {
  created: number;
  skipped: number;
  problems: Array<{ row: number; message: string }>;
};

/** Najveći fajl koji ima smisla poslati kroz server akciju (oko 2 MB teksta). */
const MAX_BYTES = 2_000_000;

/**
 * Uvoz gostiju iz CSV-a (zahtev 12).
 *
 * Fajl se čita u pregledaču i šalje kao tekst: server ga parsira i vraća
 * izveštaj red po red. Neispravan red se preskače uz objašnjenje umesto da
 * obori ceo uvoz - spisak od dvesta gostiju ne sme da propadne zbog jednog
 * praznog reda.
 */
export function ImportGuests({ eventId }: { eventId: string }) {
  const t = useTranslations();
  const router = useRouter();

  const [hasHeader, setHasHeader] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const readFile = async (file: File | undefined): Promise<void> => {
    setSummary(null);
    setError(null);

    if (!file) {
      setFileName(null);
      setCsv(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setFileName(null);
      setCsv(null);
      setError(t('errors.fileTooLarge'));
      return;
    }

    setFileName(file.name);
    setCsv(await file.text());
  };

  const submit = async (): Promise<void> => {
    if (!csv) {
      setError(t('guests.importEmpty'));
      return;
    }

    setPending(true);
    setError(null);

    const result = await importGuestsAction({ eventId, csv, hasHeader });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSummary(result.data);
    setCsv(null);
    setFileName(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('guests.importText')}</p>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {summary ? (
        <Alert
          tone={summary.problems.length > 0 ? 'warning' : 'success'}
          title={t('guests.importDone', { count: summary.created })}
        >
          {summary.skipped > 0 ? (
            <p>{t('guests.importSkipped', { count: summary.skipped })}</p>
          ) : null}

          {summary.problems.length > 0 ? (
            <>
              <p className="mt-2 font-medium">{t('guests.importProblems')}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {summary.problems.slice(0, 20).map((problem) => (
                  <li key={`${problem.row}-${problem.message}`}>
                    {t('guests.importRow', { row: problem.row })}: {problem.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Alert>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="uvoz-gostiju"
          className="block text-sm font-medium text-foreground"
        >
          {t('guests.importFile')}
        </label>
        <input
          id="uvoz-gostiju"
          type="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:border-border file:bg-surface file:px-4 file:py-2 file:text-sm"
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
        {fileName ? (
          <p className="text-xs text-muted-foreground">{fileName}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          checked={hasHeader}
          onCheckedChange={(checked) => setHasHeader(checked === true)}
        />
        {t('guests.importHasHeader')}
      </label>

      <Button onClick={() => void submit()} loading={pending} disabled={!csv}>
        <Upload aria-hidden />
        {t('guests.importSubmit')}
      </Button>
    </div>
  );
}
