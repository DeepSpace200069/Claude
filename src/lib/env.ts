import 'server-only';

import { z } from 'zod';

/**
 * Validacija serverskih environment promenljivih.
 *
 * Namerno je lenja (`getEnv()` umesto top-level parse) da bi `next build` mogao
 * da prođe i kada npr. produkcijske tajne još nisu podešene, ali svaka runtime
 * upotreba dobija validiranu i tipiziranu vrednost.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()),
  );

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    APP_URL: z.url().default('http://localhost:3000'),

    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL je obavezan (vidi .env.example)'),

    AUTH_SECRET: z.string().min(1).optional(),
    AUTH_TRUST_HOST: booleanish.default(false),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),

    EMAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
    EMAIL_FROM: z.string().default('Pozivnica <noreply@localhost>'),
    RESEND_API_KEY: z.string().optional(),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_URL: z.string().optional(),

    PAYMENT_DRIVER: z.enum(['dev', 'manual']).default('dev'),
    PAYMENT_CURRENCY: z.string().length(3).default('RSD'),
    PAYMENT_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),

    /*
     * `postgres` je podrazumevan zato što je jedini ispravan kada aplikacija
     * radi u više instanci: brojač u memoriji tada svakoj instanci daje pun
     * kvot. `memory` ostaje za razvoj i testove, gde je proces jedan.
     */
    RATE_LIMIT_DRIVER: z.enum(['memory', 'postgres']).default('postgres'),

    DATA_RETENTION_DAYS: z.coerce.number().int().min(0).default(365),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    if (!value.AUTH_SECRET || value.AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message:
          'AUTH_SECRET mora imati najmanje 32 znaka u produkciji (openssl rand -base64 32).',
      });
    }

    if (value.EMAIL_DRIVER === 'resend' && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY je obavezan kada je EMAIL_DRIVER=resend.',
      });
    }

    if (value.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_PUBLIC_URL',
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} je obavezan kada je STORAGE_DRIVER=s3.`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Neispravna konfiguracija okruženja:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

/** Samo za testove - poništava keširanu konfiguraciju. */
export function resetEnvCache(): void {
  cached = null;
}

export const isProduction = (): boolean => getEnv().NODE_ENV === 'production';
