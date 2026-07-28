import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));
const testsPath = fileURLToPath(new URL('./tests', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcPath,
      '~/tests': testsPath,
      // Vidi tests/setup/server-only-stub.ts za obrazloženje.
      'server-only': fileURLToPath(
        new URL('./tests/setup/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    // Integracioni testovi dele jednu Postgres šemu, pa se fajlovi izvršavaju
    // jedan po jedan - tako je čišćenje tabela između paketa determinističko.
    fileParallelism: false,
    maxWorkers: 1,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup/unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.tsx'],
          setupFiles: ['tests/setup/unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/integration.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
