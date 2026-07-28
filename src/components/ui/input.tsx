import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const fieldClasses = [
  'w-full rounded-[var(--radius)] border border-input bg-surface',
  'px-3.5 py-2.5 text-base md:text-sm text-surface-foreground',
  'placeholder:text-muted-foreground/70',
  'transition-[border-color,box-shadow] duration-200',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20',
].join(' ');

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClasses, 'h-11', className)}
      {...props}
    />
  );
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(fieldClasses, 'resize-y min-h-24', className)}
      {...props}
    />
  );
}

export { fieldClasses };
