import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'rounded-[var(--radius)] transition-[background-color,color,box-shadow,transform] duration-200',
    'disabled:pointer-events-none disabled:opacity-55',
    'active:translate-y-px',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover',
        secondary:
          'bg-surface text-surface-foreground border border-border shadow-soft hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-muted',
        subtle: 'bg-primary-subtle text-primary hover:bg-primary-subtle/70',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        // Touch target je najmanje 44px na primarnim veličinama (zahtev 22/31).
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renderuje se kao dete (npr. `<Link>`) uz zadržavanje stilova. */
    asChild?: boolean;
    /** Prikazuje indikator i onemogućava dugme. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Component>
  );
}

export { buttonVariants };
