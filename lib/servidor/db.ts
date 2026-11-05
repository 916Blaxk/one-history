import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

function conectar() {
  const client = createClient({
    url: process.env.DATABASE_URL || 'file:dados/one-history.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

/* Em desenvolvimento o Next recarrega os módulos; isto evita abrir uma conexão a cada recarga. */
const global_ = globalThis as unknown as { __db?: ReturnType<typeof conectar> };
export const db = global_.__db ?? (global_.__db = conectar());
