import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/servidor/schema.ts',
  out: './migracoes',
});
