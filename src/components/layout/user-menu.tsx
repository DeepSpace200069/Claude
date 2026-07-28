'use client';

import { CalendarDays, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutAction } from '@/features/auth/actions-client';

/** Meni naloga sa odjavom. */
export function UserMenu({
  name,
  email,
  labels,
}: {
  name: string | null;
  email: string;
  labels: { profile: string; signOut: string; events: string };
}) {
  const initials = (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-primary-subtle text-primary"
          aria-label={labels.profile}
        >
          <span className="text-sm font-semibold">{initials || '?'}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block font-medium text-foreground">{name ?? email}</span>
          {name ? <span className="block text-xs">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/app/dogadjaji">
            <CalendarDays aria-hidden />
            {labels.events}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/profil">
            <UserRound aria-hidden />
            {labels.profile}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-destructive outline-none transition-colors hover:bg-destructive-subtle focus-visible:bg-destructive-subtle"
          >
            <LogOut className="size-4" aria-hidden />
            {labels.signOut}
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
