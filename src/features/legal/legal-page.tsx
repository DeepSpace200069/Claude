import { Alert } from '@/components/ui/feedback';
import type { LegalDocument } from '@/content/legal';
import { formatDate } from '@/i18n/format';
import type { Locale } from '@/i18n/config';

/**
 * Prikaz pravnog dokumenta.
 *
 * Zajednički okvir za uslove korišćenja i politiku privatnosti - oba imaju istu
 * strukturu, pa nema razloga za dve gotovo identične stranice.
 */
export function LegalPage({
  title,
  document,
  locale,
  isFallback,
  labels,
}: {
  title: string;
  document: LegalDocument;
  locale: Locale;
  isFallback: boolean;
  labels: { updated: string; draftNotice: string; fallbackNotice: string };
}) {
  const updatedAt = new Date(`${document.updatedAt}T12:00:00Z`);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.updated.replace(
            '{date}',
            formatDate(updatedAt, locale, { dateStyle: 'long' }),
          )}
        </p>
      </header>

      {/*
        Dokument je radna verzija. Bolje je to reći otvoreno nego pustiti
        korisnika da veruje da ga je pregledao pravnik.
      */}
      <Alert tone="warning" className="mt-6">
        {labels.draftNotice}
      </Alert>

      {isFallback ? (
        <Alert tone="info" className="mt-3">
          {labels.fallbackNotice}
        </Alert>
      ) : null}

      <p className="mt-8 leading-relaxed text-muted-foreground">{document.intro}</p>

      <div className="mt-10 space-y-9">
        {document.sections.map((section, index) => (
          <section key={section.heading} aria-labelledby={`odeljak-${index}`}>
            <h2
              id={`odeljak-${index}`}
              className="font-display text-xl font-semibold tracking-tight"
            >
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={paragraphIndex}
                  className="leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
