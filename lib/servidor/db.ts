import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

function conectar() {
  const url = process.env.DATABASE_URL || 'file:dados/one-history.db';
  /* O libsql não cria a pasta, e o `next build` abre o banco ao coletar as páginas: sem isto, um clone novo não compila. */
  if (url.startsWith('file:')) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

/* Em desenvolvimento o Next recarrega os módulos; isto evita abrir uma conexão a cada recarga. */
const global_ = globalThis as unknown as { __db?: ReturnType<typeof conectar> };
export const db = global_.__db ?? (global_.__db = conectar());
