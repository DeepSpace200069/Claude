import { redirect } from 'next/navigation';

/** `/app` je samo ulaz - lista događaja je stvarna početna strana aplikacije. */
export default function AppIndexPage() {
  redirect('/app/dogadjaji');
}
