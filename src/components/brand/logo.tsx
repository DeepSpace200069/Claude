import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * Logotip.
 *
 * Nacrtan je kao SVG koji nasleđuje `currentColor`, pa isti logotip radi i na
 * svetloj i na tamnoj podlozi. Motiv je zapečaćena koverta sa prstenom -
 * originalan crtež, bez korišćenja tuđih vizuelnih elemenata (zahtev 11).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8', className)}
    >
      <rect
        x="2.5"
        y="7.5"
        width="27"
        height="20"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.5 10.5 14.4 18a2.8 2.8 0 0 0 3.2 0l10.9-7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle
        cx="16"
        cy="8"
        r="4.2"
        fill="var(--color-background, #faf8f5)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function Logo({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-primary', className)}>
      <LogoMark />
      {showName ? (
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          {brand.name}
        </span>
      ) : (
        <span className="sr-only">{brand.name}</span>
      )}
    </span>
  );
}
