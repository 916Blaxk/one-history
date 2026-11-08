/* Envia uma cópia do banco para o servidor como /data/restaurar.db. A troca só acontece quando o site reiniciar: veja scripts/restaurar.mjs.
   Uso: node scripts/enviar-restauracao.mjs <arquivo.db>
   Usa o mesmo apelido SSH do download, `one-history-backup`. Depois, reinicie o serviço no painel do Railway. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const SERVIDOR = 'one-history-backup';
const arquivo = process.argv[2];
if (!arquivo || !fs.existsSync(arquivo)) {
  console.error('Informe o arquivo: node scripts/enviar-restauracao.mjs <arquivo.db>');
  process.exit(1);
}

function ssh(comando, entrada) {
  return new Promise((ok, falha) => {
    const filho = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=30', '-T', SERVIDOR, comando], { stdio: [entrada ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let texto = '', erro = '';
    if (entrada) fs.createReadStream(entrada).pipe(filho.stdin);
    filho.stdout.on('data', d => { texto += d; });
    filho.stderr.on('data', d => { erro += d; });
    filho.on('error', falha);
    filho.on('close', codigo => (codigo === 0 ? ok(texto) : falha(new Error(`ssh saiu com ${codigo}: ${erro.trim()}`))));
  });
}

/* A mesma conferência que o servidor faz antes de trocar: melhor descobrir aqui do que depois do reinício. */
const conferencia = spawnSync(process.execPath, ['scripts/restaurar.mjs', '--conferir', arquivo], { encoding: 'utf8' });
if (conferencia.status !== 0) {
  console.error(`A cópia não passou na conferência: ${conferencia.stderr.trim()}`);
  process.exit(1);
}

/* Chega com outro nome e só vira restaurar.db depois de conferida: um reinício no meio do envio não troca o banco por um arquivo pela metade. */
await ssh("cat > /data/restaurar.db.parcial", arquivo);
const esperado = createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');
const obtido = (await ssh("sha256sum /data/restaurar.db.parcial")).split(/\s+/)[0];
if (esperado !== obtido) {
  await ssh('rm -f /data/restaurar.db.parcial');
  console.error('O arquivo chegou diferente ao servidor. Nada foi trocado.');
  process.exit(1);
}
await ssh('mv /data/restaurar.db.parcial /data/restaurar.db');
console.log('Cópia enviada e conferida. Reinicie o serviço no painel do Railway para trocar o banco.');
