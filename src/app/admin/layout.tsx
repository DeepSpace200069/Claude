import { forbidden, redirect } from 'next/navigation';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { AuthorizationError } from '@/server/authz/errors';
import { getCurrentUser, requireAdmin } from '@/server/authz';

/**
 * Administratorski panel (zahtev 19).
 *
 * Provera uloge stoji u layoutu, ali svaka akcija je ponavlja: layout štiti
 * prikaz, a ne mutacije (zahtev 39.5). Panel se nikad ne indeksira.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);

  try {
    await requireAdmin();
  } catch (error) {
    // 403, ne 404: korisnik zna da stranica postoji, samo nema pravo na nju.
    if (error instanceof AuthorizationError) forbidden();
    throw error;
  }

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const navigation = [
    { href: '/admin', label: t('admin.navOverview') },
    { href: '/admin/korisnici', label: t('admin.navUsers') },
    { href: '/admin/narudzbine', label: t('admin.navOrders') },
    { href: '/admin/paketi', label: t('admin.navPlans') },
    { href: '/admin/promo-kodovi', label: t('admin.navPromo') },
    { href: '/admin/sabloni', label: t('admin.navTemplates') },
    { href: '/admin/vrste-dogadjaja', label: t('admin.navEventTypes') },
    { href: '/admin/audit', label: t('admin.navAudit') },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/app/dogadjaji" aria-label={t('nav.dashboard')}>
            <Logo />
          </Link>
          <span className="text-sm font-medium text-muted-foreground">
            {t('admin.title')}
          </span>
        </div>

        <nav
          aria-label={t('admin.title')}
          className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:px-6"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 items-center rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main
        id="glavni-sadrzaj"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}

export const metadata = {
  robots: { index: false, follow: false },
};
