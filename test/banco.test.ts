import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterAll, describe, expect, it } from 'vitest';
import { backupVencido, fazerBackup, pastaDeBackup } from '../lib/servidor/backup';

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

describe('restauração', () => {
  const contar = async (arquivo: string) => {
    const c = createClient({ url: `file:${arquivo.replaceAll('\\', '/')}` });
    const n = Number((await c.execute('SELECT count(*) AS n FROM mesa_imagens')).rows[0].n);
    c.close();
    return n;
  };

  it('troca o banco pela cópia e guarda o anterior fora do rodízio', async () => {
    /* Montado em outra pasta e copiado: no Windows, o banco aberto aqui ficaria preso e o script não conseguiria trocá-lo. */
    const vivo = await bancoComDados('preparo/one-history.db');
    await vivo.execute("INSERT INTO mesa_imagens (campanha_id, id, dados) VALUES ('c', 'k', 'só no atual')");
    const copia = await fazerBackup(vivo, path.join(pasta, 'preparo', 'backups'));
    await vivo.execute("INSERT INTO mesa_imagens (campanha_id, id, dados) VALUES ('c', 'l', 'depois da cópia')");
    vivo.close();
    fs.mkdirSync(path.join(pasta, 'restaura'));
    fs.copyFileSync(path.join(pasta, 'preparo', 'one-history.db'), path.join(pasta, 'restaura', 'one-history.db'));
    fs.copyFileSync(copia!, path.join(pasta, 'restaura', 'restaurar.db'));

    const r = rodar('scripts/restaurar.mjs', [], { DATABASE_URL: url('restaura/one-history.db') });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(pasta, 'restaura', 'restaurar.db'))).toBe(false);
    expect(await contar(path.join(pasta, 'restaura', 'one-history.db'))).toBe(3);
    const guardados = fs.readdirSync(path.join(pasta, 'restaura', 'backups')).filter(n => n.endsWith('.db'));
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatch(/^antes-da-restauracao-[\d-]+\.db$/);
    expect(await contar(path.join(pasta, 'restaura', 'backups', guardados[0]))).toBe(4);
    expect(rodar('scripts/migrar.mjs', [], { DATABASE_URL: url('restaura/one-history.db') }).status).toBe(0);
  });

  it('recusa uma cópia que não é do One History e mantém o banco atual', async () => {
    (await bancoComDados('recusa/one-history.db')).close();
    fs.writeFileSync(path.join(pasta, 'recusa', 'restaurar.db'), 'isto não é um banco');
    const r = rodar('scripts/restaurar.mjs', [], { DATABASE_URL: url('recusa/one-history.db') });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('Restauração cancelada');
    expect(fs.existsSync(path.join(pasta, 'recusa', 'restaurar.db.ruim'))).toBe(true);
    expect(await contar(path.join(pasta, 'recusa', 'one-history.db'))).toBe(2);
  });

  it('sem cópia, não mexe em nada', () => {
    const r = rodar('scripts/restaurar.mjs', [], { DATABASE_URL: url('nada/one-history.db') });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(pasta, 'nada'))).toBe(false);
  });
});

describe('backup automático', () => {
  it('gera uma cópia que abre e guarda só as mais recentes', async () => {
    const c = await bancoComDados('vivo.db');
    const destino = path.join(pasta, 'backups');
    let ultima: string | null = null;
    for (let dia = 1; dia <= 4; dia++) ultima = await fazerBackup(c, destino, new Date(Date.UTC(2026, 0, dia)), 2);
    c.close();
    expect(fs.readdirSync(destino).sort()).toEqual(['one-history-20260103-000000.db', 'one-history-20260104-000000.db']);
    const copia = createClient({ url: `file:${ultima!.replaceAll('\\', '/')}` });
    expect(Number((await copia.execute('SELECT count(*) AS n FROM mesa_imagens')).rows[0].n)).toBe(2);
    copia.close();
  });

  it('não roda sem espaço no disco, para não travar o site', async () => {
    const c = await bancoComDados('apertado.db');
    const destino = path.join(pasta, 'sem-espaco');
    expect(await fazerBackup(c, destino, new Date(), 3, () => 1000)).toBeNull();
    expect(fs.readdirSync(destino)).toEqual([]);
    c.close();
  });

  it('a cópia vence pela idade da última, não pelo tempo do servidor no ar', async () => {
    const destino = path.join(pasta, 'vencimento');
    /* Pasta que ainda não existe: é o primeiro início do site. */
    expect(backupVencido(destino)).toBe(true);
    const c = await bancoComDados('vence.db');
    await fazerBackup(c, destino);
    c.close();
    const agora = Date.now(), umaHora = 60 * 60 * 1000;
    expect(backupVencido(destino, agora + umaHora)).toBe(false);
    expect(backupVencido(destino, agora + 25 * umaHora)).toBe(true);
  });

  it('só vale para banco em arquivo', () => {
    expect(pastaDeBackup('libsql://x.turso.io')).toBeNull();
    expect(pastaDeBackup('file:/volume/one-history.db')).toBe(path.join('/volume', 'backups'));
    expect(pastaDeBackup('file:/volume/one-history.db', '/copias')).toBe('/copias');
  });
});
