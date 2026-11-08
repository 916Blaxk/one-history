/* Troca o banco por uma cópia deixada ao lado dele com o nome restaurar.db. Roda antes das migrações, ao iniciar o site.
   Só aqui, com o servidor ainda parado, a troca é segura: com o site no ar, ele mantém o banco aberto e seguiria gravando no arquivo antigo.
   O banco que sai vai para a pasta de backups como antes-da-restauracao-<data>.db, fora do rodízio das cópias automáticas.
   Sem restaurar.db, não faz nada. Uma cópia que não passa na conferência vira restaurar.db.ruim e o site sobe com o banco atual. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const CONFERIR = '--conferir';

/* Em outro processo: no Windows, a biblioteca do banco segura o arquivo mesmo depois de fechar, e ele não poderia ser renomeado. */
if (process.argv[2] === CONFERIR) {
  const banco = createClient({ url: 'file:' + process.argv[3].replaceAll('\\', '/') });
  const { rows } = await banco.execute('PRAGMA integrity_check').catch(e => {
    console.error(e.message);
    process.exit(1);
  });
  if (rows[0]?.integrity_check !== 'ok') {
    console.error(String(rows[0]?.integrity_check));
    process.exit(1);
  }
  const tabela = await banco.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'");
  if (!tabela.rows.length) {
    console.error('não é um banco do One History: falta a tabela usuarios');
    process.exit(1);
  }
  process.exit(0);
}

try { process.loadEnvFile('.env'); } catch { /* .env é opcional */ }

const url = process.env.DATABASE_URL || 'file:dados/one-history.db';
if (!url.startsWith('file:')) process.exit(0);
const banco = url.slice(5);
const pasta = path.dirname(banco);
const copia = path.join(pasta, 'restaurar.db');
if (!fs.existsSync(copia)) process.exit(0);

const conferencia = spawnSync(process.execPath, [fileURLToPath(import.meta.url), CONFERIR, copia], { encoding: 'utf8' });
if (conferencia.status !== 0) {
  fs.renameSync(copia, copia + '.ruim');
  console.error(`Restauração cancelada, o site segue com o banco atual. A cópia não passou na conferência: ${conferencia.stderr.trim()}`);
  process.exit(0);
}

if (fs.existsSync(banco)) {
  const backups = process.env.BACKUP_DIR || path.join(pasta, 'backups');
  fs.mkdirSync(backups, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const guardado = path.join(backups, `antes-da-restauracao-${carimbo}.db`);
  /* O -wal pode ter as últimas gravações: vai junto, com o nome que o SQLite procura ao abrir o guardado. */
  for (const sufixo of ['', '-wal', '-shm']) {
    if (fs.existsSync(banco + sufixo)) fs.renameSync(banco + sufixo, guardado + sufixo);
  }
  console.log(`Banco anterior guardado em ${guardado}`);
}
fs.renameSync(copia, banco);
console.log(`Banco restaurado a partir de ${copia}`);
