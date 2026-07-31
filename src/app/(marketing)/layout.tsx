import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { getCurrentUser } from '@/server/authz';

/** Zajednički okvir marketinških stranica: zaglavlje, sadržaj i podnožje. */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const user = await getCurrentUser();

  const primaryLinks = [
    { href: '/sabloni', label: t('nav.templates') },
    { href: '/kako-funkcionise', label: t('nav.howItWorks') },
    { href: '/cenovnik', label: t('nav.pricing') },
    { href: '/cesta-pitanja', label: t('nav.faq') },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label={brand.name}>
            <Logo />
          </Link>

          <nav
            aria-label={t('nav.home')}
            className="hidden flex-1 items-center gap-1 md:flex"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher current={locale} label={t('nav.language')} />
            {user ? (
              <Button asChild size="sm">
                <Link href="/app/dogadjaji">{t('nav.dashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/app/dogadjaji/novi">{t('marketing.heroCta')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="glavni-sadrzaj" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-surface/60">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {t('brand.tagline')}
            </p>
          </div>

          <FooterColumn
            title={t('marketing.footerProduct')}
            links={[
              { href: '/sabloni', label: t('nav.templates') },
              { href: '/cenovnik', label: t('nav.pricing') },
              { href: '/kako-funkcionise', label: t('nav.howItWorks') },
            ]}
          />
          <FooterColumn
            title={t('marketing.footerCompany')}
            links={[
              { href: '/cesta-pitanja', label: t('nav.faq') },
              { href: '/kontakt', label: t('nav.contact') },
            ]}
          />
          <FooterColumn
            title={t('marketing.footerLegal')}
            links={[
              { href: '/uslovi-koriscenja', label: t('nav.terms') },
              { href: '/politika-privatnosti', label: t('nav.privacy') },
              { href: '/kolacici', label: t('cookies.title') },
            ]}
          />
        </div>

        <div className="border-t border-border/70">
          <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
            © {new Date().getFullYear()} {brand.name}. {t('marketing.footerRights')}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
