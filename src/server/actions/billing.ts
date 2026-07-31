'use server';

import { revalidatePath } from 'next/cache';

import { startCheckoutSchema } from '@/features/billing/schemas';
import { requireEventAccess } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import {
  checkoutReturnUrl,
  startCheckout,
  type CheckoutResult,
} from '@/server/services/billing';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Naplata paketa za jednu pozivnicu (zahtev 17).
 *
 * Pravo `billing:manage` je vlasničko - saradnik sme da uređuje pozivnicu, ali
 * ne i da troši tuđ novac.
 */
export async function startCheckoutAction(
  input: unknown,
): Promise<ActionResult<CheckoutResult>> {
  try {
    const parsed = startCheckoutSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Proverite unete podatke.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'billing:manage');

    const limit = await rateLimit(`checkout:${access.user.id}`, RATE_LIMITS.checkout);
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše pokušaja naplate. Sačekajte pa probajte ponovo.',
      );
    }

    const result = await startCheckout({
      userId: access.user.id,
      eventId: parsed.data.eventId,
      planId: parsed.data.planId,
      promoCode: parsed.data.promoCode ?? null,
      returnUrl: checkoutReturnUrl(parsed.data.eventId),
    });

    // Plaćen paket menja i prava i dugme za objavljivanje, pa obe stranice
    // moraju da se osveže.
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/naplata`);
    revalidatePath(`/app/dogadjaji/${parsed.data.eventId}/objavljivanje`);

    return success(result);
  } catch (error) {
    return toActionFailure(error);
  }
}
