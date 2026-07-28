import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

const tones = {
  info: 'bg-muted text-foreground border-border',
  success: 'bg-success-subtle text-success border-success/25',
  warning: 'bg-warning-subtle text-warning border-warning/25',
  error: 'bg-destructive-subtle text-destructive border-destructive/25',
} as const;

export type AlertProps = ComponentProps<'div'> & {
  tone?: keyof typeof icons;
  title?: ReactNode;
};

/** Statička poruka u toku stranice (za prolazne poruke koristi `toast`). */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const Icon = icons[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-[var(--radius)] border p-4 text-sm',
        tones[tone],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-[var(--radius)] bg-muted', className)}
      {...props}
    />
  );
}

/** Prazno stanje sa objašnjenjem i pozivom na akciju (zahtev 30). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-surface/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
