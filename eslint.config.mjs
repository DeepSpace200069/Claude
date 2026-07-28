import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint konfiguracija (flat config).
 *
 * `eslint-config-next` od verzije 16 isporučuje flat config direktno, pa nema
 * potrebe za `FlatCompat` omotačem.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'src/server/db/migrations/**',
      'next-env.d.ts',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Poslovna logika ne sme da piše u konzolu; upozorenja i greške smeju.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-implicit-coercion': ['error', { boolean: false }],
    },
  },

  {
    /*
     * Rendereri pozivnice namerno koriste `<img>` umesto `next/image`.
     *
     * Fotografije dolaze sa storage hosta koji je konfigurabilan kroz env
     * (`STORAGE_DRIVER`, `S3_PUBLIC_URL`), pa bi `next/image` za svaki novi
     * host tražio izmenu `next.config.ts` i redeploy. Uz `loading="lazy"`,
     * `sizes` i `decoding="async"` efekat na performanse je isti za ovaj
     * slučaj upotrebe. Vidi `InvitationImage` u `renderers/shared.tsx`.
     */
    files: ['src/features/sections/renderers/**/*.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },

  {
    /*
     * Playwright fixture prima callback `use()`. ESLint pravilo za React hook-ove
     * prepoznaje taj naziv kao hook, iako sa Reactom nema veze - isključujemo ga
     * samo za E2E testove.
     */
    files: ['tests/e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  {
    // Skripte i testovi smeju da ispisuju u konzolu.
    files: [
      'src/server/db/*.ts',
      'src/server/adapters/email/console-adapter.ts',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      '*.config.ts',
      '*.config.mjs',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default config;
