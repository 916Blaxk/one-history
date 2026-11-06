import { defineConfig } from '@playwright/test';

/* Testa no navegador de verdade. Usa o Edge já instalado no Windows; em outros sistemas, troque `channel`. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  /* No CI, as falhas viram anotações, que dá para ler sem baixar o log. */
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3458',
    channel: 'msedge',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/servidor-teste.mjs 3458',
    url: 'http://127.0.0.1:3458/entrar',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
