import { ImageResponse } from 'next/og';

import { brand } from '@/config/brand';
import { formatDate } from '@/i18n/format';
import { getPublicInvitation } from '@/server/services/public-invitation';

/**
 * Kartica koja se vidi kada se link pozivnice pošalje u poruci (zahtev 16 i 4.4).
 *
 * Slika se crta iz **teme same pozivnice**, pa kartica u Viberu ili WhatsAppu
 * izgleda kao ta pozivnica, a ne kao generička reklama platforme.
 *
 * Privatnost je ovde jednako važna kao izgled: zaštićena pozivnica i pozivnica
 * dostupna samo preko ličnih linkova dobijaju neutralnu karticu. Ko nema PIN, ne
 * treba iz pregleda linka da sazna imena, datum ni mesto proslave.
 */
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = brand.name;

export default async function InvitationOpenGraphImage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const invitation = await getPublicInvitation(publicSlug);

  const isProtected =
    !invitation ||
    invitation.status !== 'published' ||
    invitation.privacy === 'pin' ||
    invitation.privacy === 'invite_only';

  if (isProtected) return neutralCard();

  const palette = invitation.document.theme.palette;
  const heading = invitation.share.title || invitation.title || brand.name;
  const subtitle = invitation.share.description || invitation.summary;
  const date = invitation.startsAt
    ? formatDate(invitation.startsAt, invitation.locale, {
        timeZone: invitation.timeZone,
      })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
          padding: 80,
          background: palette.background,
          color: palette.text,
          // Samo sistemski fontovi: preuzimanje font fajla pri svakom
          // generisanju je i sporije i još jedna tačka otkaza.
          fontFamily: 'Georgia, serif',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: palette.textMuted,
          }}
        >
          {brand.name}
        </div>

        <div style={{ display: 'flex', fontSize: 72, lineHeight: 1.1, maxWidth: 960 }}>
          {truncate(heading, 70)}
        </div>

        <div
          style={{ display: 'flex', width: 140, height: 3, background: palette.accent }}
        />

        {date ? (
          <div style={{ display: 'flex', fontSize: 34, color: palette.textMuted }}>
            {date}
          </div>
        ) : null}

        {subtitle ? (
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: palette.textMuted,
              maxWidth: 880,
            }}
          >
            {truncate(subtitle, 140)}
          </div>
        ) : null}
      </div>
    ),
    size,
  );
}

/** Kartica koja ne odaje ništa o sadržaju zaštićene pozivnice. */
function neutralCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: '#faf8f5',
          color: '#2b2724',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: '#6d655e' }}>
          {brand.name.toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontSize: 56 }}>Pozivnica</div>
        <div style={{ display: 'flex', width: 120, height: 2, background: '#7d3f57' }} />
      </div>
    ),
    size,
  );
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}
