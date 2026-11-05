/* O site não envia e-mail, então a recuperação de senha é feita por quem administra o servidor.
   Uso: npm run senha -- pessoa@exemplo.com */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

try { process.loadEnvFile('.env'); } catch { /* .env é opcional */ }

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Informe o e-mail: npm run senha -- pessoa@exemplo.com');
  process.exit(1);
}
const client = createClient({ url: process.env.DATABASE_URL || 'file:dados/one-history.db', authToken: process.env.DATABASE_AUTH_TOKEN });
const { rows } = await client.execute({ sql: 'select id from usuarios where email = ?', args: [email] });
if (!rows.length) {
  console.error(`Nenhuma conta com o e-mail ${email}.`);
  process.exit(1);
}
const temporaria = crypto.randomBytes(9).toString('base64url');
const sal = crypto.randomBytes(16);
const chave = await promisify(crypto.scrypt)(temporaria, sal, 64);
await client.batch([
  { sql: 'update usuarios set senha_hash = ? where id = ?', args: [`${sal.toString('hex')}:${chave.toString('hex')}`, rows[0].id] },
  { sql: 'delete from sessoes where usuario_id = ?', args: [rows[0].id] },
], 'write');
client.close();
console.log(`Senha temporária de ${email}: ${temporaria}`);
console.log('Peça para a pessoa entrar com ela e trocar em Minha conta.');
