/* Copia um banco inteiro para outro lugar: do arquivo local para o Turso, ou do Turso para um arquivo de backup.
   Uso: node scripts/copiar-banco.mjs <origem> <destino>
   Exemplo: node scripts/copiar-banco.mjs file:dados/one-history.db libsql://seu-banco.turso.io
   Os tokens vêm de ORIGEM_TOKEN e DESTINO_TOKEN, nunca da linha de comando, que fica no histórico do terminal. */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

/* Cenários e sprites podem ter quase 1 MB por linha, e um pedido grande demais falha no Turso. */
const LIMITE_POR_ENVIO = 256 * 1024;

const [origem, destino] = process.argv.slice(2);
if (!origem || !destino) {
  console.error('Uso: node scripts/copiar-banco.mjs <origem> <destino>');
  process.exit(1);
}
if (destino.startsWith('file:')) fs.mkdirSync(path.dirname(destino.slice(5)), { recursive: true });

const de = createClient({ url: origem, authToken: process.env.ORIGEM_TOKEN });
const para = createClient({ url: destino, authToken: process.env.DESTINO_TOKEN });

const objetos = (await de.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table' DESC")).rows;
const tabelas = objetos.filter(o => o.type === 'table');

/* Nunca escreve por cima: um destino com dados pode ser o banco de verdade. */
const existentes = (await para.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).rows;
for (const { name } of existentes) {
  const { rows } = await para.execute(`SELECT count(*) AS n FROM "${name}"`);
  if (Number(rows[0].n) > 0) {
    console.error(`O destino já tem dados (tabela ${name}). Nada foi copiado. Use um banco vazio.`);
    process.exit(1);
  }
}
for (const { name } of existentes) await para.execute(`DROP TABLE "${name}"`);

for (const tabela of tabelas) await para.execute(tabela.sql);

for (const { name } of tabelas) {
  const { rows, columns } = await de.execute(`SELECT * FROM "${name}"`);
  const colunas = columns.map(c => `"${c}"`).join(', ');
  const marcas = columns.map(() => '?').join(', ');
  let lote = [];
  let tamanho = 0;
  const enviar = async () => {
    if (lote.length) await para.batch(lote, 'write');
    lote = [];
    tamanho = 0;
  };
  for (const linha of rows) {
    const args = columns.map(c => linha[c]);
    const peso = args.reduce((soma, v) => soma + (typeof v === 'string' ? v.length : 16), 0);
    if (tamanho + peso > LIMITE_POR_ENVIO) await enviar();
    lote.push({ sql: `INSERT INTO "${name}" (${colunas}) VALUES (${marcas})`, args });
    tamanho += peso;
  }
  await enviar();
  const { rows: conferencia } = await para.execute(`SELECT count(*) AS n FROM "${name}"`);
  if (Number(conferencia[0].n) !== rows.length) throw new Error(`A tabela ${name} não foi copiada por inteiro.`);
  console.log(`${name}: ${rows.length} linhas`);
}
for (const objeto of objetos.filter(o => o.type !== 'table')) await para.execute(objeto.sql);

de.close();
para.close();
console.log('Cópia concluída e conferida.');
