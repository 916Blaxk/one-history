import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterAll, describe, expect, it } from 'vitest';
import { fazerBackup, pastaDeBackup } from '../lib/servidor/backup';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'one-history-banco-'));
const url = (nome: string) => `file:${path.join(pasta, nome).replaceAll('\\', '/')}`;
const rodar = (script: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

async function bancoComDados(nome: string) {
  expect(rodar('scripts/migrar.mjs', [], { DATABASE_URL: url(nome) }).status).toBe(0);
  const c = createClient({ url: url(nome) });
  await c.execute({ sql: "INSERT INTO mesa_imagens (campanha_id, id, dados) VALUES ('c', 'i', ?)", args: ['x'.repeat(300_000)] });
  await c.execute("INSERT INTO mesa_imagens (campanha_id, id, dados) VALUES ('c', 'j', 'pequena')");
  return c;
}

/* No Windows, o arquivo pode seguir preso por um instante depois de fechado. Sobra só uma pasta temporária. */
afterAll(() => { try { fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* sem problema */ } });

describe('cópia do banco', () => {
  it('copia tudo para um banco vazio, inclusive linhas grandes e o registro de migrações', async () => {
    const origem = await bancoComDados('origem.db');
    const r = rodar('scripts/copiar-banco.mjs', [url('origem.db'), url('copia/destino.db')]);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const destino = createClient({ url: url('copia/destino.db') });
    const { rows } = await destino.execute('SELECT id, length(dados) AS n FROM mesa_imagens ORDER BY id');
    expect(rows.map(l => [l.id, Number(l.n)])).toEqual([['i', 300_000], ['j', 7]]);

    /* A cópia precisa continuar aceitando as migrações, sem tentar recriar as tabelas. */
    destino.close();
    expect(rodar('scripts/migrar.mjs', [], { DATABASE_URL: url('copia/destino.db') }).status).toBe(0);

    const indices = (await origem.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")).rows[0].n;
    const copia = createClient({ url: url('copia/destino.db') });
    expect((await copia.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")).rows[0].n).toBe(indices);
    copia.close();
    origem.close();
  });

  it('não escreve em um destino que já tem dados', async () => {
    (await bancoComDados('cheio.db')).close();
    (await bancoComDados('outro.db')).close();
    const r = rodar('scripts/copiar-banco.mjs', [url('outro.db'), url('cheio.db')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('já tem dados');
    const c = createClient({ url: url('cheio.db') });
    expect(Number((await c.execute('SELECT count(*) AS n FROM mesa_imagens')).rows[0].n)).toBe(2);
    c.close();
  });
});

describe('backup automático', () => {
  it('gera uma cópia que abre e guarda só as mais recentes', async () => {
    const c = await bancoComDados('vivo.db');
    const destino = path.join(pasta, 'backups');
    let ultima = '';
    for (let dia = 1; dia <= 4; dia++) ultima = await fazerBackup(c, destino, new Date(Date.UTC(2026, 0, dia)), 2);
    c.close();
    expect(fs.readdirSync(destino).sort()).toEqual(['one-history-20260103-000000.db', 'one-history-20260104-000000.db']);
    const copia = createClient({ url: `file:${ultima.replaceAll('\\', '/')}` });
    expect(Number((await copia.execute('SELECT count(*) AS n FROM mesa_imagens')).rows[0].n)).toBe(2);
    copia.close();
  });

  it('só vale para banco em arquivo', () => {
    expect(pastaDeBackup('libsql://x.turso.io')).toBeNull();
    expect(pastaDeBackup('file:/volume/one-history.db')).toBe(path.join('/volume', 'backups'));
    expect(pastaDeBackup('file:/volume/one-history.db', '/copias')).toBe('/copias');
  });
});
