'use client';

/**
 * Vidljivo dugme za preskakanje uvoda.
 *
 * Odvojeno u sopstveni modul da bi moglo da se učita sa `ssr: false`: bez
 * JavaScripta klik ne bi radio, a dugme koje ništa ne radi je gore nego dugme
 * kog nema. Uvod se i bez njega povlači sam, kroz CSS animaciju.
 */
export function IntroSkipButton({
  label,
  onSkip,
}: {
  label: string;
  onSkip: () => void;
}) {
  return (
    <button
      type="button"
      className="inv-intro__skip"
      onClick={(event) => {
        event.stopPropagation();
        onSkip();
      }}
    >
      {label}
    </button>
  );
}
