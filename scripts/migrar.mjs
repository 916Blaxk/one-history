/* Aplica as migrações do banco. Roda sozinho antes de dev, build e start. */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

try { process.loadEnvFile('.env'); } catch { /* .env é opcional */ }

const url = process.env.DATABASE_URL || 'file:dados/one-history.db';
if (url.startsWith('file:')) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
await migrate(drizzle(client), { migrationsFolder: 'migracoes' });
client.close();
