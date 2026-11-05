import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@mesa': fileURLToPath(new URL('./mesa/src', import.meta.url)) } },
  test: {
    include: ['test/**/*.test.ts', 'mesa/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
