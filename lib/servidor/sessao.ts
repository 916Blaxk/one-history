import crypto from 'crypto';
import { promisify } from 'util';
import { and, eq, lt, ne } from 'drizzle-orm';
import { db } from './db';
import { sessoes, usuarios } from './schema';
import type { Usuario } from '../tipos';

const scrypt = promisify(crypto.scrypt) as (s: string, sal: Buffer, n: number) => Promise<Buffer>;
export const COOKIE = 'oh_sessao';
export const SESSAO_S = 30 * 24 * 3600;

export async function gerarHash(senha: string) {
  const sal = crypto.randomBytes(16);
  return `${sal.toString('hex')}:${(await scrypt(senha, sal, 64)).toString('hex')}`;
}
export async function conferirHash(senha: string, guardado: string) {
  const [sal, chave] = guardado.split(':');
  return crypto.timingSafeEqual(await scrypt(senha, Buffer.from(sal, 'hex'), 64), Buffer.from(chave, 'hex'));
}

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export async function criarSessao(usuarioId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.delete(sessoes).where(lt(sessoes.expira, Date.now()));
  await db.insert(sessoes).values({ hash: hashToken(token), usuarioId, expira: Date.now() + SESSAO_S * 1000 });
  return token;
}
export async function usuarioDoToken(token: string | undefined | null): Promise<(Usuario & { senhaHash: string }) | null> {
  if (!token) return null;
  const [linha] = await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, senhaHash: usuarios.senhaHash, expira: sessoes.expira })
    .from(sessoes).innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id)).where(eq(sessoes.hash, hashToken(token)));
  if (!linha || linha.expira < Date.now()) return null;
  const { expira: _, ...u } = linha;
  return u;
}
export async function apagarSessoes(usuarioId: string, exceto?: string) {
  await db.delete(sessoes).where(exceto ? and(eq(sessoes.usuarioId, usuarioId), ne(sessoes.hash, exceto)) : eq(sessoes.usuarioId, usuarioId));
}
export async function usuarioDaSessao(): Promise<Usuario | null> {
  /* Importado aqui: o servidor da mesa carrega este arquivo fora do Next, onde next/headers quebra ao carregar. */
  const { cookies } = await import('next/headers');
  const u = await usuarioDoToken((await cookies()).get(COOKIE)?.value);
  return u && { id: u.id, nome: u.nome, email: u.email };
}
