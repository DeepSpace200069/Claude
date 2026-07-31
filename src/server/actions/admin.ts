'use server';

import { revalidatePath } from 'next/cache';

import {
  activateOrderSchema,
  createPromoCodeSchema,
  eventTypeActiveSchema,
  promoCodeActiveSchema,
  setUserRoleSchema,
  templateStatusSchema,
  templateVersionSchema,
  updatePlanSchema,
} from '@/features/admin/schemas';
import { requireAdmin } from '@/server/authz';
import {
  activateOrder,
  createPromoCode,
  publishTemplateVersion,
  setEventTypeActive,
  setPromoCodeActive,
  setTemplateStatus,
  setUserRole,
  updatePlan,
} from '@/server/services/admin';

import {
  failure,
  success,
  toActionFailure,
  zodFieldErrors,
  type ActionResult,
} from './result';

/**
 * Administrativne akcije (zahtev 19 i 24).
 *
 * Svaka prvo prolazi kroz `requireAdmin()`, a sam servis upisuje audit zapis sa
 * akterom. Interfejs se ne pita ni za jedno pravo - i zahtev poslat mimo
 * interfejsa staje ovde.
 */

/** Zajednički deo: provera prava i raščlanjivanje ulaza. */
async function withAdmin<T>(
  parse: () => { ok: true; value: T } | { ok: false; result: ActionResult<never> },
  run: (value: T, actor: { id: string; email: string }) => Promise<void>,
  revalidate: string[],
): Promise<ActionResult<null>> {
  try {
    const user = await requireAdmin();
    const parsed = parse();
    if (!parsed.ok) return parsed.result;

    await run(parsed.value, { id: user.id, email: user.email });

    for (const path of revalidate) revalidatePath(path);
    return success(null);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function setUserRoleAction(input: unknown): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = setUserRoleSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({
            ok: false,
            result: failure('validation', 'Neispravan zahtev.'),
          } as const);
    },
    async (value, actor) => setUserRole({ ...value, actor }),
    ['/admin/korisnici'],
  );
}

export async function activateOrderAction(input: unknown): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = activateOrderSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({
            ok: false,
            result: failure('validation', 'Unesite razlog aktivacije.', {
              fieldErrors: zodFieldErrors(parsed.error.issues),
            }),
          } as const);
    },
    async (value, actor) => activateOrder({ ...value, actor }),
    ['/admin/narudzbine', '/admin'],
  );
}

export async function updatePlanAction(input: unknown): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = updatePlanSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({
            ok: false,
            result: failure('validation', 'Proverite unete podatke.', {
              fieldErrors: zodFieldErrors(parsed.error.issues),
            }),
          } as const);
    },
    async (value, actor) => updatePlan({ ...value, actor }),
    ['/admin/paketi', '/cenovnik'],
  );
}

export async function publishTemplateVersionAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = templateVersionSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({ ok: false, result: failure('validation', 'Neispravan zahtev.') } as const);
    },
    async (value, actor) => publishTemplateVersion({ ...value, actor }),
    ['/admin/sabloni', '/sabloni'],
  );
}

export async function setTemplateStatusAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = templateStatusSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({ ok: false, result: failure('validation', 'Neispravan zahtev.') } as const);
    },
    async (value, actor) => setTemplateStatus({ ...value, actor }),
    ['/admin/sabloni', '/sabloni'],
  );
}

export async function setEventTypeActiveAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = eventTypeActiveSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({ ok: false, result: failure('validation', 'Neispravan zahtev.') } as const);
    },
    async (value, actor) => setEventTypeActive({ ...value, actor }),
    ['/admin/vrste-dogadjaja'],
  );
}

export async function createPromoCodeAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = createPromoCodeSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({
            ok: false,
            result: failure('validation', 'Proverite unete podatke.', {
              fieldErrors: zodFieldErrors(parsed.error.issues),
            }),
          } as const);
    },
    async (value, actor) => createPromoCode({ ...value, actor }),
    ['/admin/promo-kodovi'],
  );
}

export async function setPromoCodeActiveAction(
  input: unknown,
): Promise<ActionResult<null>> {
  return withAdmin(
    () => {
      const parsed = promoCodeActiveSchema.safeParse(input);
      return parsed.success
        ? ({ ok: true, value: parsed.data } as const)
        : ({ ok: false, result: failure('validation', 'Neispravan zahtev.') } as const);
    },
    async (value, actor) => setPromoCodeActive({ ...value, actor }),
    ['/admin/promo-kodovi'],
  );
}
