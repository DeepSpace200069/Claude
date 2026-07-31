'use server';

import { revalidatePath } from 'next/cache';

import {
  collaboratorRefSchema,
  collaboratorRoleSchema,
  inviteCollaboratorSchema,
} from '@/features/collaborators/schemas';
import { getRequestLocale } from '@/i18n/server';
import { requireEventAccess } from '@/server/authz';
import {
  changeCollaboratorRole,
  inviteCollaborator,
  revokeCollaborator,
} from '@/server/services/collaborators';
import { recordActivity } from '@/server/services/events';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Saradnici (zahtev 25).
 *
 * Pozivanje i opoziv su vlasničke radnje (`collaborators:manage`), pa saradnik
 * ne može da dovede još saradnika niti da izbaci onoga ko ga je pozvao.
 */

export async function inviteCollaboratorAction(
  input: unknown,
): Promise<ActionResult<{ emailSent: boolean }>> {
  try {
    const parsed = inviteCollaboratorSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(
      parsed.data.eventId,
      'collaborators:manage',
    );

    const result = await inviteCollaborator({
      eventId: parsed.data.eventId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: {
        id: access.user.id,
        name: access.user.name,
        email: access.user.email,
      },
      locale: await getRequestLocale(),
    });

    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/saradnici`);

    await recordActivity({
      eventId: parsed.data.eventId,
      actorId: access.user.id,
      kind: 'collaborator_invited',
      payload: { role: parsed.data.role },
    });

    return success({ emailSent: result.emailSent });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function changeCollaboratorRoleAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = collaboratorRoleSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'collaborators:manage');
    await changeCollaboratorRole(parsed.data);

    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/saradnici`);
    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function revokeCollaboratorAction(
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const parsed = collaboratorRefSchema.safeParse(input);
    if (!parsed.success) return failure('validation', 'Neispravan zahtev.');

    await requireEventAccess(parsed.data.eventId, 'collaborators:manage');
    await revokeCollaborator(parsed.data);

    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/saradnici`);
    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}
