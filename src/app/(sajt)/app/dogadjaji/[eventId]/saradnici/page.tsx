import { notFound } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/features/billing/entitlements';
import {
  CollaboratorPanel,
  type CollaboratorView,
} from '@/features/collaborators/collaborator-panel';
import { TranslationsProvider } from '@/i18n/client';
import { loadMessages } from '@/i18n/messages';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireEventPageAccess } from '@/server/authz/page-guards';
import {
  changeCollaboratorRoleAction,
  inviteCollaboratorAction,
  revokeCollaboratorAction,
} from '@/server/actions/collaborators';
import { listCollaborators } from '@/server/services/collaborators';
import { getEventEntitlements } from '@/server/services/entitlements';
import { getEventDetail } from '@/server/services/events';

/**
 * Saradnici na događaju (zahtev 25).
 *
 * Stranicu vidi samo vlasnik: `collaborators:manage` je vlasničko pravo, pa
 * saradnik ne može da pozove još nekoga.
 */
export default async function CollaboratorsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireEventPageAccess(eventId, 'collaborators:manage');

  const [event, entitlements, collaborators] = await Promise.all([
    getEventDetail(eventId),
    getEventEntitlements(eventId),
    listCollaborators(eventId),
  ]);

  if (!event) notFound();

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);

  const view: CollaboratorView[] = collaborators.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
  }));

  return (
    <TranslationsProvider
      locale={locale}
      messages={{
        collaborators: messages.collaborators,
        common: messages.common,
        errors: messages.errors,
        validation: messages.validation,
      }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('collaborators.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('collaborators.subtitle')}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('collaborators.invite')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CollaboratorPanel
              eventId={eventId}
              collaborators={view}
              canInvite={can(entitlements, 'collaborators')}
              planName={entitlements.planName}
              billingHref={`/app/dogadjaji/${eventId}/naplata`}
              invite={inviteCollaboratorAction}
              changeRole={changeCollaboratorRoleAction}
              revoke={revokeCollaboratorAction}
            />
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
}
