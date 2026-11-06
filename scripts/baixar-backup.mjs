/* Baixa para este PC a cópia mais recente do banco que o servidor guarda em /data/backups.
   Uso: node scripts/baixar-backup.mjs [pasta]
   A conexão vem do apelido `one-history-backup` em ~/.ssh/config. O arquivo tem as contas de todos: nunca coloque no repositório, que é público. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const SERVIDOR = 'one-history-backup';
const MANTER = 5;
const CONFERIR = '--conferir';
const pasta = (process.argv[2] !== CONFERIR && process.argv[2]) || path.join(os.homedir(), 'Documents', 'one-history-backups');
const registro = path.join(pasta, 'baixar-backup.log');

function anotar(texto) {
  const linha = `${new Date().toISOString()} ${texto}`;
  console.log(linha);
  fs.appendFileSync(registro, linha + '\n');
}

/* Sem TTY e sem perguntas: em uma tarefa agendada, qualquer pergunta deixaria o processo parado para sempre. */
function ssh(comando, saida) {
  return new Promise((ok, falha) => {
    const filho = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=30', '-T', SERVIDOR, comando], { stdio: ['ignore', 'pipe', 'pipe'] });
    let texto = '', erro = '';
    if (saida) filho.stdout.pipe(saida);
    else filho.stdout.on('data', d => { texto += d; });
    filho.stderr.on('data', d => { erro += d; });
    filho.on('error', falha);
    filho.on('close', codigo => (codigo === 0 ? ok(texto) : falha(new Error(`ssh saiu com ${codigo}: ${erro.trim()}`))));
  });
}

async function baixar() {
  const remoto = (await ssh('ls -1 /data/backups/one-history-*.db | tail -1')).trim();
  if (!/^\/data\/backups\/one-history-[\d-]+\.db$/.test(remoto)) throw new Error(`Nome de cópia inesperado: ${remoto}`);
  const nome = path.basename(remoto), destino = path.join(pasta, nome);
  if (fs.existsSync(destino)) {
    anotar(`${nome} já estava aqui`);
    return;
  }

  /* Só vira o arquivo final depois de conferido: uma queda no meio não deixa uma cópia ruim com cara de boa. */
  const parcial = destino + '.parcial';
  try {
    const arquivo = fs.createWriteStream(parcial);
    await Promise.all([ssh(`cat '${remoto}'`, arquivo), new Promise((ok, falha) => arquivo.on('finish', ok).on('error', falha))]);
    const esperado = (await ssh(`sha256sum '${remoto}'`)).split(/\s+/)[0];
    const obtido = createHash('sha256').update(fs.readFileSync(parcial)).digest('hex');
    if (esperado !== obtido) throw new Error('O arquivo chegou diferente do servidor.');
    /* Em outro processo: no Windows, a biblioteca do banco segura o arquivo mesmo depois de fechar, e ele não poderia ser renomeado. */
    const conferencia = spawnSync(process.execPath, [fileURLToPath(import.meta.url), CONFERIR, parcial], { encoding: 'utf8' });
    if (conferencia.status !== 0) throw new Error(`A cópia baixada não passou na conferência: ${conferencia.stderr.trim()}`);
    fs.renameSync(parcial, destino);
  } finally {
    /* A limpeza não pode esconder o erro que importa. */
    try { fs.rmSync(parcial, { force: true }); } catch (e) { console.error(`Não consegui apagar ${parcial}: ${e.message}`); }
  }

  const copias = fs.readdirSync(pasta).filter(n => /^one-history-[\d-]+\.db$/.test(n)).sort();
  for (const antiga of copias.slice(0, Math.max(0, copias.length - MANTER))) fs.rmSync(path.join(pasta, antiga));
  anotar(`${nome} baixado, ${fs.statSync(destino).size} bytes, conferido`);
}

if (process.argv[2] === CONFERIR) {
  const banco = createClient({ url: 'file:' + process.argv[3].replaceAll('\\', '/') });
  const { rows } = await banco.execute('PRAGMA integrity_check');
  if (rows[0]?.integrity_check !== 'ok') {
    console.error(String(rows[0]?.integrity_check));
    process.exit(1);
  }
  process.exit(0);
}

fs.mkdirSync(pasta, { recursive: true });
try {
  await baixar();
} catch (e) {
  anotar(`FALHOU: ${e.message}`);
  /* Backup que falha em silêncio é o pior caso: em tarefa agendada, ninguém olha o console. */
  spawn('msg', [os.userInfo().username, `One History: o backup falhou. Veja ${registro}`], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  process.exitCode = 1;
}
