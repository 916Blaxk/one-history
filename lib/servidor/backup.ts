import fs from 'node:fs';
import path from 'node:path';
import type { Client } from '@libsql/client';

const PREFIXO = 'one-history-';

function espacoLivreEm(pasta: string) {
  const { bavail, bsize } = fs.statfsSync(pasta);
  return bavail * bsize;
}

/* VACUUM INTO gera uma cópia consistente mesmo com o site no ar. Só serve para banco em arquivo.
   O backup divide o volume com o banco: encher o disco travaria o site, então, sem espaço, ele não roda e devolve null. */
export async function fazerBackup(client: Client, pasta: string, agora = new Date(), manter = 3, espacoLivre = espacoLivreEm) {
  fs.mkdirSync(pasta, { recursive: true });
  const copias = fs.readdirSync(pasta).filter(n => n.startsWith(PREFIXO) && n.endsWith('.db')).sort();
  for (const antiga of copias.slice(0, Math.max(0, copias.length - manter + 1))) fs.rmSync(path.join(pasta, antiga));

  const { rows } = await client.execute('SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()');
  if (espacoLivre(pasta) < Number(rows[0].bytes) * 2) return null;

  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const destino = path.join(pasta, `${PREFIXO}${carimbo}.db`);
  await client.execute({ sql: 'VACUUM INTO ?', args: [destino] });
  return destino;
}

/* Conta pela última cópia, não pelo tempo no ar: cada publicação reinicia o servidor, e um relógio de 24 horas nunca chegaria ao fim. */
export function backupVencido(pasta: string, agora = Date.now(), idadeMaxima = 24 * 60 * 60 * 1000) {
  if (!fs.existsSync(pasta)) return true;
  const copias = fs.readdirSync(pasta).filter(n => n.startsWith(PREFIXO) && n.endsWith('.db'));
  const maisNova = Math.max(0, ...copias.map(n => fs.statSync(path.join(pasta, n)).mtimeMs));
  return agora - maisNova >= idadeMaxima;
}

/* Com Turso, as cópias ficam a cargo do próprio serviço: veja docs/publicar.md. */
export function pastaDeBackup(url: string, configurada?: string) {
  if (!url.startsWith('file:')) return null;
  return configurada || path.join(path.dirname(url.slice(5)), 'backups');
}
