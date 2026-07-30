import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Translator } from '@/i18n/translator';
import type { Messages } from '@/i18n/messages';

import type { GuestFilters } from './schemas';

/**
 * Filteri spiska gostiju (zahtev 12).
 *
 * Obična `GET` forma, bez ijedne linije JavaScripta: stanje živi u URL-u, pa se
 * filtrirani spisak može podeliti linkom, otvoriti u novoj kartici i vratiti
 * dugmetom „nazad”. To je i jedini oblik koji radi pre nego što se učita
 * JavaScript.
 */
export function GuestFiltersBar({
  eventId,
  filters,
  tags,
  t,
}: {
  eventId: string;
  filters: GuestFilters;
  tags: readonly string[];
  t: Translator<Messages>;
}) {
  const selectClass =
    'h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm';

  const isFiltered =
    Boolean(filters.pretraga) ||
    Boolean(filters.oznaka) ||
    filters.odgovor !== 'svi' ||
    filters.redosled !== 'prezime';

  return (
    <form
      method="get"
      className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="lg:col-span-2">
        <label htmlFor="pretraga" className="mb-1.5 block text-sm font-medium">
          {t('guests.search')}
        </label>
        <Input
          id="pretraga"
          name="pretraga"
          type="search"
          defaultValue={filters.pretraga ?? ''}
          placeholder={t('guests.searchPlaceholder')}
        />
      </div>

      <div>
        <label htmlFor="oznaka" className="mb-1.5 block text-sm font-medium">
          {t('guests.filterTag')}
        </label>
        <select
          id="oznaka"
          name="oznaka"
          defaultValue={filters.oznaka ?? ''}
          className={selectClass}
        >
          <option value="">{t('guests.allTags')}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="odgovor" className="mb-1.5 block text-sm font-medium">
          {t('guests.filterResponse')}
        </label>
        <select
          id="odgovor"
          name="odgovor"
          defaultValue={filters.odgovor}
          className={selectClass}
        >
          <option value="svi">{t('guests.allResponses')}</option>
          <option value="pending">{t('guests.responsePending')}</option>
          <option value="yes">{t('guests.responseYes')}</option>
          <option value="no">{t('guests.responseNo')}</option>
          <option value="maybe">{t('guests.responseMaybe')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="redosled" className="mb-1.5 block text-sm font-medium">
          {t('guests.sort')}
        </label>
        <select
          id="redosled"
          name="redosled"
          defaultValue={filters.redosled}
          className={selectClass}
        >
          <option value="prezime">{t('guests.sortByLastName')}</option>
          <option value="ime">{t('guests.sortByFirstName')}</option>
          <option value="najnoviji">{t('guests.sortByNewest')}</option>
        </select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="submit" variant="secondary">
          {t('guests.applyFilters')}
        </Button>

        {isFiltered ? (
          <Button asChild variant="ghost">
            <Link href={`/app/dogadjaji/${eventId}/gosti`}>
              {t('guests.clearFilters')}
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
