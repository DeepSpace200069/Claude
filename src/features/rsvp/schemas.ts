import { z } from 'zod';

import {
  RSVP_QUESTION_TYPES,
  type RsvpAnswerValue,
  type RsvpQuestion,
} from './types';

/**
 * Šeme RSVP-a (zahtev 12 i 13).
 *
 * Isti modul koristi i forma u pregledaču i server akcija. Klijentska provera
 * postoji zbog brze poruke, ali odluku donosi isključivo server - polje
 * sakriveno u interfejsu nije zaštita (zahtev 24).
 */

// --- Dodatna pitanja organizatora -------------------------------------------

export const rsvpOptionSchema = z.object({
  /** Prazno pri dodavanju nove opcije; ključ dodeljuje server. */
  value: z.string().trim().max(16).default(''),
  label: z.string().trim().min(1).max(120),
});

export const rsvpQuestionInputSchema = z
  .object({
    type: z.enum(RSVP_QUESTION_TYPES),
    label: z.string().trim().min(1).max(160),
    helpText: z.string().trim().max(300).default(''),
    isRequired: z.boolean().default(false),
    attendingOnly: z.boolean().default(true),
    options: z.array(rsvpOptionSchema).max(20).default([]),
    min: z.union([z.coerce.number().int().min(0).max(999), z.literal('')]).default(''),
    max: z.union([z.coerce.number().int().min(0).max(999), z.literal('')]).default(''),
    maxLength: z
      .union([z.coerce.number().int().min(10).max(2000), z.literal('')])
      .default(''),
  })
  .superRefine((value, ctx) => {
    const needsOptions = value.type === 'single_choice' || value.type === 'multi_choice';

    if (needsOptions && value.options.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Pitanje sa ponuđenim odgovorima mora imati bar dve opcije.',
      });
    }

    if (
      value.type === 'number' &&
      value.min !== '' &&
      value.max !== '' &&
      value.min > value.max
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'Najveća vrednost ne sme biti manja od najmanje.',
      });
    }
  });

export type RsvpQuestionFormValues = z.input<typeof rsvpQuestionInputSchema>;
export type RsvpQuestionInput = z.output<typeof rsvpQuestionInputSchema>;

export const createQuestionSchema = z.object({
  eventId: z.uuid(),
  question: rsvpQuestionInputSchema,
});

export const updateQuestionSchema = z.object({
  eventId: z.uuid(),
  questionId: z.uuid(),
  question: rsvpQuestionInputSchema,
});

export const deleteQuestionSchema = z.object({
  eventId: z.uuid(),
  questionId: z.uuid(),
});

export const reorderQuestionsSchema = z.object({
  eventId: z.uuid(),
  questionIds: z.array(z.uuid()).max(50),
});

// --- Odgovor gosta ----------------------------------------------------------

export const RSVP_ANSWER_STATUSES = ['yes', 'no', 'maybe'] as const;

/**
 * Slanje odgovora sa javne pozivnice.
 *
 * `answers` ostaje `unknown` po vrednosti: oblik zavisi od tipa pitanja, koji se
 * zna tek kada se pitanja učitaju iz baze. Vrednosti proverava `validateAnswers`
 * na serveru.
 */
export const rsvpSubmissionSchema = z.object({
  slug: z.string().trim().min(3).max(60),
  /** Token ličnog linka; prazno za javni RSVP. */
  token: z.string().trim().max(64).default(''),
  /** Token za izmenu već poslatog odgovora. */
  editToken: z.string().trim().max(64).default(''),

  fullName: z.string().trim().min(2, 'Unesite ime i prezime.').max(120),
  email: z.union([z.email().max(160), z.literal('')]).default(''),
  phone: z
    .union([
      z
        .string()
        .trim()
        .max(32)
        .regex(/^[+()\d\s./-]+$/, 'Telefon sme da sadrži samo cifre i znakove + ( ) - . /'),
      z.literal(''),
    ])
    .default(''),

  status: z.enum(RSVP_ANSWER_STATUSES),
  adultsCount: z.coerce.number().int().min(0).max(30).default(1),
  childrenCount: z.coerce.number().int().min(0).max(30).default(0),
  companions: z.array(z.string().trim().max(80)).max(30).default([]),
  message: z.string().trim().max(1000).default(''),

  answers: z.record(z.uuid(), z.unknown()).default({}),

  /** Potpisani ključ obrasca (vidi `lib/form-nonce`). */
  nonce: z.string().min(1).max(200),
  /**
   * Polje-mamac.
   *
   * Sakriveno je i van redosleda tabulatora, pa ga gost nikad ne vidi. Ako u
   * njemu ima teksta, obrazac je popunio automat.
   */
  companyName: z.string().max(200).default(''),
});

export type RsvpSubmissionInput = z.output<typeof rsvpSubmissionSchema>;
export type RsvpFormValues = z.input<typeof rsvpSubmissionSchema>;

// --- Provera odgovora na dodatna pitanja ------------------------------------

export type AnswerValidation = {
  values: Record<string, RsvpAnswerValue>;
  errors: Record<string, string[]>;
};

/**
 * Proverava odgovore na dodatna pitanja prema definiciji svakog pitanja.
 *
 * Pitanja vezana za dolazak se za goste koji ne dolaze **ne** proveravaju i ne
 * čuvaju: gost koji je rekao „ne dolazim" ih nikad nije ni video, pa bi
 * poruka „polje je obavezno" bila besmislena.
 */
export function validateAnswers(
  questions: readonly RsvpQuestion[],
  raw: Record<string, unknown>,
  status: 'yes' | 'no' | 'maybe',
): AnswerValidation {
  const values: Record<string, RsvpAnswerValue> = {};
  const errors: Record<string, string[]> = {};

  for (const question of questions) {
    if (question.attendingOnly && status !== 'yes') continue;

    const parsed = answerSchemaFor(question).safeParse(raw[question.id]);

    if (!parsed.success) {
      errors[`answers.${question.id}`] = parsed.error.issues.map(
        (issue) => issue.message,
      );
      continue;
    }

    if (parsed.data === undefined) {
      if (question.isRequired) {
        errors[`answers.${question.id}`] = ['Ovo polje je obavezno.'];
      }
      continue;
    }

    values[question.id] = parsed.data;
  }

  return { values, errors };
}

/**
 * Zod šema za jedan odgovor.
 *
 * `undefined` znači „nije odgovoreno" i propušta se dalje - je li to greška
 * odlučuje `validateAnswers` na osnovu toga da li je pitanje obavezno.
 */
export function answerSchemaFor(
  question: RsvpQuestion,
): z.ZodType<RsvpAnswerValue | undefined> {
  const optional = <T extends z.ZodType>(schema: T) =>
    z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      schema.optional(),
    ) as unknown as z.ZodType<RsvpAnswerValue | undefined>;

  switch (question.type) {
    case 'single_choice': {
      const allowed = (question.config.options ?? []).map((option) => option.value);
      return optional(
        z.string().refine((value) => allowed.includes(value), {
          message: 'Izaberite jednu od ponuđenih opcija.',
        }),
      );
    }

    case 'multi_choice': {
      const allowed = (question.config.options ?? []).map((option) => option.value);
      return z.preprocess(
        (value) => {
          const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
          return list.length === 0 ? undefined : list;
        },
        z
          .array(z.string())
          .max(20)
          .refine((values) => values.every((value) => allowed.includes(value)), {
            message: 'Izaberite među ponuđenim opcijama.',
          })
          .optional(),
      ) as unknown as z.ZodType<RsvpAnswerValue | undefined>;
    }

    case 'boolean':
      return z.preprocess(
        (value) => {
          if (value === undefined || value === null || value === '') return undefined;
          if (typeof value === 'boolean') return value;
          return value === 'true' || value === 'da' || value === '1';
        },
        z.boolean().optional(),
      ) as unknown as z.ZodType<RsvpAnswerValue | undefined>;

    case 'number': {
      let schema = z.coerce.number().int();
      if (question.config.min !== undefined) schema = schema.min(question.config.min);
      if (question.config.max !== undefined) schema = schema.max(question.config.max);
      return optional(schema);
    }

    case 'date':
      return optional(
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Unesite ispravan datum.'),
      );

    case 'text':
    default:
      return optional(z.string().trim().max(question.config.maxLength ?? 500));
  }
}
