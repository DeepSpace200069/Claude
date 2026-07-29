import { brand } from '@/config/brand';
import { formatDate } from '@/i18n/format';
import { getTranslations } from '@/i18n/server';
import type { AccessResult } from '@/server/services/public-invitation';

import { InvitationNotice } from './notice-page';
import { PinGate } from './pin-gate';

/**
 * Sve što gost vidi umesto pozivnice.
 *
 * Jedno mesto za oba javna ulaza (običan link i personalizovani), da se poruke
 * ne bi razišle. Nijedno stanje ne prikazuje deo sadržaja pozivnice - ni naslov,
 * ni imena, ni datum proslave.
 */
export type UnavailableState = Exclude<AccessResult, { state: 'ok' }>;

export async function InvitationUnavailable({
  state,
  slug,
}: {
  state: UnavailableState;
  slug: string;
}) {
  // Kod zaštićene pozivnice znamo jezik događaja, pa i kapija za PIN govori
  // jezikom kojim je pozivnica napisana.
  const locale = state.state === 'pin_required' ? state.invitation.locale : undefined;
  const t = await getTranslations(locale);
  const footerLabel = t('publicInvitation.backHome', { brand: brand.name });

  switch (state.state) {
    case 'pin_required':
      return (
        <InvitationNotice
          title={t('publicInvitation.pinTitle')}
          text={t('publicInvitation.pinText')}
          footerLabel={footerLabel}
        >
          <PinGate
            slug={slug}
            labels={{
              label: t('publicInvitation.pinLabel'),
              submit: t('publicInvitation.pinSubmit'),
              wrong: t('publicInvitation.pinWrong'),
              tooMany: t('publicInvitation.pinTooMany'),
            }}
          />
        </InvitationNotice>
      );

    case 'expired':
      return (
        <InvitationNotice
          title={t('publicInvitation.expiredTitle')}
          text={t('publicInvitation.expiredText', {
            date: formatDate(state.expiresAt, t.locale),
          })}
          footerLabel={footerLabel}
        />
      );

    case 'not_published':
      return (
        <InvitationNotice
          title={t('publicInvitation.unpublishedTitle')}
          text={t('publicInvitation.unpublishedText')}
          footerLabel={footerLabel}
        />
      );

    case 'invite_only':
      return (
        <InvitationNotice
          title={t('publicInvitation.inviteOnlyTitle')}
          text={t('publicInvitation.inviteOnlyText')}
          footerLabel={footerLabel}
        />
      );

    default:
      return (
        <InvitationNotice
          title={t('publicInvitation.notFoundTitle')}
          text={t('publicInvitation.notFoundText')}
          footerLabel={footerLabel}
        />
      );
  }
}
