'use server';

import { revalidatePath } from 'next/cache';

import {
  createEventSchema,
  deleteEventSchema,
  updateEventSchema,
} from '@/features/events/schemas';
import { requireEventAccess, requireUser } from '@/server/authz';
import { NotFoundError, ValidationError } from '@/server/authz/errors';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import {
  createEvent,
  getEventDetail,
  recordActivity,
  softDeleteEvent,
  updateEvent,
} from '@/server/services/events';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Server akcije za događaje.
 *
 * Redosled u svakoj akciji je uvek isti i namerno: autentifikacija ->
 * ograničenje učestalosti -> validacija -> autorizacija nad konkretnim
 * resursom -> posao. Ni jedan korak se ne preskače, čak i kada interfejs već
 * krije dugme (zahtev 24 i 39.5).
 */

export async function createEventAction(
  input: unknown,
): Promise<ActionResult<{ eventId: string; slug: string }>> {
  try {
    const user = await requireUser();

    const limit = rateLimit(`create-event:${user.id}`, RATE_LIMITS.createEvent);
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše novih događaja u kratkom roku. Pokušajte kasnije.',
      );
    }

    const parsed = createEventSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const result = await createEvent(user.id, parsed.data);

    await recordActivity({
      eventId: result.eventId,
      invitationId: result.invitationId,
      actorId: user.id,
      kind: 'invitation_edited',
      payload: { action: 'created' },
    });

    revalidatePath('/app/dogadjaji');

    return success({ eventId: result.eventId, slug: result.slug });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateEventAction(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  try {
    const parsed = updateEventSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    // Autorizacija ide posle validacije jer nam treba proveren `id`, ali pre
    // bilo kakvog pisanja u bazu.
    const access = await requireEventAccess(parsed.data.id, 'event:edit');

    await updateEvent(parsed.data.id, parsed.data);

    await recordActivity({
      eventId: parsed.data.id,
      actorId: access.user.id,
      kind: 'invitation_edited',
      payload: { action: 'details_updated' },
    });

    revalidatePath(`/app/dogadjaji/${parsed.data.id}`);
    revalidatePath('/app/dogadjaji');

    return success({ eventId: parsed.data.id });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteEventAction(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  try {
    const parsed = deleteEventSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.id, 'event:delete');

    const event = await getEventDetail(parsed.data.id);
    if (!event) throw new NotFoundError('Događaj ne postoji ili nemate pristup.');

    // Potvrda kucanjem naziva - zaštita od slučajnog brisanja (zahtev 30).
    if (parsed.data.confirmation.trim() !== event.name.trim()) {
      throw new ValidationError('Naziv se ne poklapa.', {
        confirmation: ['Unesite tačan naziv događaja da biste potvrdili brisanje.'],
      });
    }

    await softDeleteEvent(parsed.data.id);

    revalidatePath('/app/dogadjaji');

    return success({ eventId: parsed.data.id });
  } catch (error) {
    return toActionFailure(error);
  }
}
