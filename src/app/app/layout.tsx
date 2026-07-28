import { CalendarDays, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { UserMenu } from '@/components/layout/user-menu';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { getCurrentUser } from '@/server/authz';

/**
 * Okvir aplikacije za prijavljene korisnike.
 *
 * Provera prijave stoji u layoutu, pa nijedna podstranica ne može da se otvori
 * bez sesije čak i ako zaboravi sopstvenu proveru. Same akcije ipak ponavljaju
 * proveru - layout nije bezbednosna granica za mutacije (zahtev 39.5).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/app/dogadjaji')}`);
  }

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const navigation = [
    { href: '/app/dogadjaji', label: t('nav.events'), icon: CalendarDays },
    { href: '/app/profil', label: t('nav.profile'), icon: UserRound },
    ...(user.role === 'admin'
      ? [{ href: '/admin', label: t('nav.admin'), icon: Shield }]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/app/dogadjaji" aria-label={t('nav.dashboard')}>
            <Logo />
          </Link>

          <nav
            aria-label={t('nav.dashboard')}
            className="ml-4 hidden items-center gap-1 sm:flex"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher current={locale} label={t('nav.language')} />
            <UserMenu
              name={user.name}
              email={user.email}
              labels={{
                profile: t('nav.profile'),
                signOut: t('auth.signOut'),
                events: t('nav.events'),
              }}
            />
          </div>
        </div>

        {/* Na malim ekranima navigacija ide ispod zaglavlja. */}
        <nav
          aria-label={t('nav.dashboard')}
          className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="glavni-sadrzaj" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** Kontrolni panel nikad ne sme da se indeksira. */
export const metadata = {
  robots: { index: false, follow: false },
};
