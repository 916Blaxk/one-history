import fs from 'node:fs';
import path from 'node:path';
import type { Client } from '@libsql/client';

const PREFIXO = 'one-history-';

/* VACUUM INTO gera uma cópia consistente mesmo com o site no ar. Só serve para banco em arquivo. */
export async function fazerBackup(client: Client, pasta: string, agora = new Date(), manter = 7) {
  fs.mkdirSync(pasta, { recursive: true });
  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const destino = path.join(pasta, `${PREFIXO}${carimbo}.db`);
  await client.execute({ sql: 'VACUUM INTO ?', args: [destino] });
  const copias = fs.readdirSync(pasta).filter(n => n.startsWith(PREFIXO) && n.endsWith('.db')).sort();
  for (const antiga of copias.slice(0, Math.max(0, copias.length - manter))) fs.rmSync(path.join(pasta, antiga));
  return destino;
}

/* Com Turso, as cópias ficam a cargo do próprio serviço: veja docs/publicar.md. */
export function pastaDeBackup(url: string, configurada?: string) {
  if (!url.startsWith('file:')) return null;
  return configurada || path.join(path.dirname(url.slice(5)), 'backups');
}
