import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

/** Miran, fokusiran okvir za stranice prijave. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(70%_50%_at_50%_0%,var(--color-primary-subtle),transparent)]">
      <header className="px-6 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>

      <main
        id="glavni-sadrzaj"
        className="flex flex-1 items-start justify-center px-4 pb-20 pt-6 sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
