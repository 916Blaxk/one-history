/* Sobe o site com um banco temporário, para os testes não tocarem nos dados reais.
   Uso: node scripts/servidor-teste.mjs 3457 (exige `next build` feito antes).
   Com BANCO_TESTE, usa esse arquivo: o teste de reinício precisa encontrar o mesmo banco. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const porta = process.argv[2] || '3457';
const arquivo = process.env.BANCO_TESTE || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'one-history-')), 'teste.db');
const env = { ...process.env, DATABASE_URL: 'file:' + arquivo.replaceAll('\\', '/'), PORT: porta };

const m = spawnSync(process.execPath, ['scripts/migrar.mjs'], { env, stdio: 'inherit' });
if (m.status !== 0) process.exit(m.status ?? 1);

const servidor = spawn(process.execPath, ['--import', 'tsx', 'servidor.ts'], { env, stdio: 'inherit' });
servidor.on('exit', c => process.exit(c ?? 0));
const sair = () => servidor.kill();
process.on('SIGINT', sair);
process.on('SIGTERM', sair);
