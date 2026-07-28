import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from '@/features/profile/profile-form';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireUserPage } from '@/server/authz/page-guards';
import { getUserProfile } from '@/server/services/profile';

/** Profil korisnika: ime, jezik i učestalost obaveštenja (zahtev 6 i 28). */
export default async function ProfilePage() {
  const user = await requireUserPage('/app/profil');
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const profile = await getUserProfile(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t('profile.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            locale={locale}
            messages={{
              profile: messages.profile,
              common: messages.common,
              errors: messages.errors,
            }}
            defaultValues={{
              name: profile?.name ?? '',
              locale: profile?.locale ?? locale,
              rsvpNotifications: profile?.rsvpNotifications ?? 'daily',
            }}
            email={user.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.dataTitle')}</CardTitle>
          <CardDescription>{t('profile.dataSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            Preuzimanje i brisanje podataka su deo Faze 8 (privatnost i
            retencija). Do tada ne prikazujemo dugmad koja ništa ne rade -
            lažna funkcionalnost je gora od izostanka funkcionalnosti.
          */}
          <p className="text-sm text-muted-foreground">
            {t('profile.dataComingSoon')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
