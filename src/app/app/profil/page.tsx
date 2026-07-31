import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataControls } from '@/features/profile/data-controls';
import { DELETE_CONFIRMATION } from '@/features/profile/delete-account';
import { ProfileForm } from '@/features/profile/profile-form';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireUserPage } from '@/server/authz/page-guards';
import { deleteAccountAction } from '@/server/actions/privacy';
import { getUserProfile } from '@/server/services/profile';
import { deletionPreview, retentionDays } from '@/server/services/privacy';

/** Profil korisnika: ime, jezik i učestalost obaveštenja (zahtev 6 i 28). */
export default async function ProfilePage() {
  const user = await requireUserPage('/app/profil');
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const profile = await getUserProfile(user.id);
  // Ekran potvrde mora da kaže tačno šta nestaje; broj se čita, ne pogađa.
  const preview = await deletionPreview(user.id);

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
          <TranslationsProvider
            locale={locale}
            messages={{
              profile: messages.profile,
              common: messages.common,
              errors: messages.errors,
              validation: messages.validation,
            }}
          >
            <DataControls
              downloadHref="/app/profil/podaci"
              preview={preview}
              confirmationWord={DELETE_CONFIRMATION}
              retentionDays={retentionDays()}
              deleteAccount={deleteAccountAction}
            />
          </TranslationsProvider>
        </CardContent>
      </Card>
    </div>
  );
}
