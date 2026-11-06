import crypto from 'crypto';
import { and, count, desc, eq, inArray, isNull, lt, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { rollDice } from '../../mesa/src/features/chat/dice-parser';
import type { DiceRollResult } from '../../mesa/src/features/chat/dice-types';
import * as R from '../regras';
import { lerAcao, resumoDaFicha } from '../resumoFicha';
import type { Ficha, Mensagem, PaginaChat, Papel, ResumoFicha } from '../tipos';
import { avisarMesa } from './barramento';
import { db } from './db';
import { campanhas, chavesIntegracao, fichas, membros, mensagensMesa, mesaImagens, mesas, rolagens, sessoes, tentativas, usuarios } from './schema';
import { apagarSessoes, conferirHash, COOKIE, criarSessao, gerarHash, hashToken, SESSAO_S, usuarioDoToken } from './sessao';

const LIMITE_CORPO = 512 * 1024;
const LIMITE_FICHAS = 200, LIMITE_CAMPANHAS = 50, LIMITE_MEMBROS = 60, LIMITE_FOTO = 200_000;
/* Cada chat guarda as 500 rolagens mais recentes e entrega 50 por vez. */
const LIMITE_ROLAGENS = 500, PAGINA_CHAT = 50;
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FOTO_VALIDA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const CAMPOS_FICHA = new Set(['player', 'nome', 'idade', 'raca', 'estilo', 'tier', 'inventario', 'notas', 'manaPerdida', 'fadiga', 'vidaAtual', 'manaAtual', 'magias', 'elementosCriados']);
/* O núcleo define os SP: se o jogador pudesse mudá-lo, o limite de SP não valeria nada. */
const CAMPOS_MESTRE = new Set(['ajustes', 'limites', 'nucleo', 'publica']);
const JANELA_MS = 15 * 60 * 1000;

export class Erro extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}

type UsuarioSessao = NonNullable<Awaited<ReturnType<typeof usuarioDoToken>>>;
interface Ctx {
  req: Request;
  params: Record<string, string>;
  corpo: Record<string, any>;
  usuario: UsuarioSessao;
  token: string | undefined;
  ip: string;
  status: number;
  cookie: string | null;
}
type Manipulador = (ctx: Ctx) => Promise<unknown>;

/* ---------- Validação ---------- */
const nomePessoa = z.string({ error: 'Use um nome entre 2 e 60 caracteres.' }).trim().min(2, 'Use um nome entre 2 e 60 caracteres.').max(60, 'Use um nome entre 2 e 60 caracteres.');
const senha = z.string({ error: 'A senha precisa ter pelo menos 8 caracteres.' }).min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200, 'Use uma senha de até 200 caracteres.');
const emailValido = z.string({ error: 'Digite um e-mail válido, como nome@exemplo.com.' }).trim().toLowerCase().pipe(z.email('Digite um e-mail válido, como nome@exemplo.com.').max(254));
const esquemaCadastro = z.object({ nome: nomePessoa, email: emailValido, senha });
const esquemaCampanha = z.object({
  nome: z.string({ error: 'Dê à campanha um nome entre 2 e 80 caracteres.' }).trim().min(2, 'Dê à campanha um nome entre 2 e 80 caracteres.').max(80, 'Dê à campanha um nome entre 2 e 80 caracteres.'),
  descricao: z.string().trim().max(600, 'A descrição pode ter até 600 caracteres.').default(''),
});
function validar<T extends z.ZodType>(esquema: T, corpo: unknown): z.output<T> {
  const r = esquema.safeParse(corpo);
  if (!r.success) throw new Erro(400, r.error.issues[0].message);
  return r.data;
}

/* ---------- Limite de tentativas ---------- */
async function excedeu(chave: string, max: number) {
  const [t] = await db.select().from(tentativas).where(eq(tentativas.chave, chave));
  return !!t && t.ate >= Date.now() && t.n >= max;
}
async function contar(chave: string, janelaMs = JANELA_MS) {
  const agora = Date.now();
  await db.insert(tentativas).values({ chave, n: 1, ate: agora + janelaMs }).onConflictDoUpdate({
    target: tentativas.chave,
    set: {
      n: sql`case when ${tentativas.ate} < ${agora} then 1 else ${tentativas.n} + 1 end`,
      ate: sql`case when ${tentativas.ate} < ${agora} then ${agora + janelaMs} else ${tentativas.ate} end`,
    },
  });
}
const limparTentativa = (chave: string) => db.delete(tentativas).where(eq(tentativas.chave, chave));
const muitasTentativas = () => new Erro(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.');

/* ---------- Ajudantes ---------- */
const novoId = (p: string) => p + crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
function cabecalhoCookie(req: Request, valor: string, maxAge: number) {
  const https = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https:');
  return `${COOKIE}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}
const usuarioPublico = (u: UsuarioSessao | typeof usuarios.$inferSelect) => ({ id: u.id, nome: u.nome, email: u.email });
const nomeFicha = (d: R.DadosFicha) => d.nome || 'Sem nome';
const colunasFicha = {
  id: fichas.id, donoId: fichas.donoId, campanhaId: fichas.campanhaId, dados: fichas.dados, registro: fichas.registro,
  fotoV: fichas.fotoV, atualizado: fichas.atualizado,
};
type LinhaFicha = { id: string; donoId: string; campanhaId: string | null; dados: R.DadosFicha; registro: { em: number; txt: string }[]; fotoV: number; atualizado: number };

async function nomesDe(ids: string[]) {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map<string, string>();
  const linhas = await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(inArray(usuarios.id, unicos));
  return new Map(linhas.map(l => [l.id, l.nome]));
}
async function nomeDe(id: string) { return (await nomesDe([id])).get(id) ?? 'Conta removida'; }

async function gerarCodigo() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
    const [existe] = await db.select({ id: campanhas.id }).from(campanhas).where(eq(campanhas.codigo, c));
    if (!existe) return c;
  }
}
async function papelEm(campanhaId: string, usuarioId: string): Promise<Papel | null> {
  const [m] = await db.select({ papel: membros.papel }).from(membros).where(and(eq(membros.campanhaId, campanhaId), eq(membros.usuarioId, usuarioId)));
  return m?.papel ?? null;
}
async function campanhaDoMembro(id: string, usuario: UsuarioSessao) {
  const [c] = await db.select().from(campanhas).where(eq(campanhas.id, id));
  /* Quem não participa recebe "não encontrada": a existência da campanha não vaza. */
  if (!c || !(await papelEm(id, usuario.id))) throw new Erro(404, 'Campanha não encontrada, ou você não participa dela.');
  return c;
}
async function campanhaDoMestre(id: string, usuario: UsuarioSessao) {
  const c = await campanhaDoMembro(id, usuario);
  if (c.mestreId !== usuario.id) throw new Erro(403, 'Só o mestre da campanha pode fazer isso.');
  return c;
}
async function fichaEditavel(id: string, usuario: UsuarioSessao): Promise<LinhaFicha> {
  const [f] = await db.select(colunasFicha).from(fichas).where(eq(fichas.id, id));
  if (f && f.donoId === usuario.id) return f;
  if (f && f.campanhaId) {
    const [c] = await db.select({ mestreId: campanhas.mestreId }).from(campanhas).where(eq(campanhas.id, f.campanhaId));
    if (c?.mestreId === usuario.id) return f;
  }
  throw new Erro(404, 'Ficha não encontrada, ou você não tem acesso a ela.');
}
async function mestreDaFicha(f: LinhaFicha, usuario: UsuarioSessao) {
  if (!f.campanhaId) return false;
  const [c] = await db.select({ mestreId: campanhas.mestreId }).from(campanhas).where(eq(campanhas.id, f.campanhaId));
  return c?.mestreId === usuario.id;
}
async function fichaDoDono(id: string, usuario: UsuarioSessao) {
  const f = await fichaEditavel(id, usuario);
  if (f.donoId !== usuario.id) throw new Erro(403, 'Só o dono da ficha pode fazer isso.');
  return f;
}
async function comContexto(f: LinhaFicha, usuario: UsuarioSessao): Promise<Ficha> {
  const [c] = f.campanhaId ? await db.select().from(campanhas).where(eq(campanhas.id, f.campanhaId)) : [];
  return {
    /* Fichas antigas no banco não têm os campos novos: a tela sempre recebe a ficha completa. */
    ...R.normalizar(f.dados), id: f.id, donoId: f.donoId, campanhaId: f.campanhaId, registro: f.registro, fotoV: f.fotoV, atualizado: f.atualizado,
    contexto: {
      souDono: f.donoId === usuario.id,
      souMestre: !!c && c.mestreId === usuario.id,
      donoNome: await nomeDe(f.donoId),
      campanha: c ? { id: c.id, nome: c.nome } : null,
    },
  };
}
/* Grava comparando `atualizado`: se outra pessoa salvou no meio do caminho, relê e aplica de novo em vez de sobrescrever. */
export async function alterarFicha(id: string, mudar: (f: LinhaFicha) => void, extras: Partial<typeof fichas.$inferInsert> = {}): Promise<LinhaFicha> {
  for (let i = 0; i < 6; i++) {
    const [f] = await db.select(colunasFicha).from(fichas).where(eq(fichas.id, id));
    if (!f) throw new Erro(404, 'Ficha não encontrada.');
    const antes = f.atualizado;
    mudar(f);
    f.atualizado = Math.max(Date.now(), antes + 1);
    const feito = await db.update(fichas).set({ dados: f.dados, registro: f.registro, atualizado: f.atualizado, ...extras })
      .where(and(eq(fichas.id, id), eq(fichas.atualizado, antes))).returning({ id: fichas.id });
    if (feito.length) {
      if (extras.fotoV !== undefined) f.fotoV = extras.fotoV;
      avisarMesa({ tipo: 'ficha', fichaId: f.id, campanhaId: f.campanhaId });
      return f;
    }
  }
  throw new Erro(409, 'A ficha está sendo editada por outra pessoa agora. Tente de novo.');
}
function resumoFicha(f: LinhaFicha, usuarioId: string, mestreId: string, nomes: Map<string, string>): ResumoFicha {
  const base = { id: f.id, nome: f.dados.nome, raca: f.dados.raca, fotoV: f.fotoV, donoId: f.donoId, donoNome: nomes.get(f.donoId) ?? 'Conta removida' };
  /* Vida, mana e fadiga dos outros não saem do servidor para quem não é mestre. */
  if (f.donoId !== usuarioId && mestreId !== usuarioId) return { ...base, completo: false };
  return {
    ...base, completo: true, ...(mestreId === usuarioId && f.donoId === mestreId ? { privada: R.fichaPrivada(f, mestreId) } : {}), estilo: f.dados.estilo, tier: f.dados.tier, fadiga: f.dados.fadiga,
    vidaAtual: f.dados.vidaAtual, vidaMax: R.vidaMax(f.dados), manaAtual: f.dados.manaAtual, manaMax: R.manaMax(f.dados),
  };
}
/* A fadiga é do mestre enquanto a ficha está na campanha. Fica guardada na saída para que tirar a ficha, mudar o valor e voltar não mude nada. É SQL para valer no mesmo batch, com a fadiga do momento da gravação. */
const soltarFichas = (campanhaId: string, condicao?: ReturnType<typeof and>) =>
  db.update(fichas).set({
    campanhaId: null,
    fadigasCampanha: sql`json_set(${fichas.fadigasCampanha}, ${`$."${campanhaId}"`}, coalesce(json_extract(${fichas.dados}, '$.fadiga'), 0))`,
    atualizado: sql`${fichas.atualizado} + 1`,
  }).where(and(eq(fichas.campanhaId, campanhaId), condicao));

async function apagarCampanha(id: string) {
  await db.batch([
    soltarFichas(id),
    db.delete(membros).where(eq(membros.campanhaId, id)),
    db.delete(rolagens).where(eq(rolagens.campanhaId, id)),
    db.delete(mensagensMesa).where(eq(mensagensMesa.campanhaId, id)),
    db.delete(mesaImagens).where(eq(mesaImagens.campanhaId, id)),
    db.delete(mesas).where(eq(mesas.campanhaId, id)),
    db.delete(campanhas).where(eq(campanhas.id, id)),
  ]);
  avisarMesa({ tipo: 'campanha-apagada', campanhaId: id });
}
async function removerMembro(campanhaId: string, usuarioId: string) {
  await db.batch([
    db.delete(membros).where(and(eq(membros.campanhaId, campanhaId), eq(membros.usuarioId, usuarioId))),
    soltarFichas(campanhaId, eq(fichas.donoId, usuarioId)),
  ]);
  avisarMesa({ tipo: 'campanha', campanhaId });
}
function rolar(lados: number, bonus: number, adicional = 0) {
  if (!R.DADOS.includes(lados)) throw new Erro(400, 'Esse dado não existe no rolador. Use d4, d6, d8, d10, d12, d20 ou d100.');
  const expressao = `1d${lados}${adicional ? `+1d${adicional}` : ''}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `-${-bonus}` : ''}`;
  const detalhe = rollDice(expressao);
  return { d: detalhe.groups[0].dice[0].rolls[0], lados, adicional, dAdicional: adicional ? detalhe.groups[1].dice[0].rolls[0] : 0, bonus, total: detalhe.total, expressao, detalhe };
}
const detalheRolagem = (r: ReturnType<typeof rolar>) =>
  `d${r.lados} (${r.d})${r.adicional ? ` + d${r.adicional} (${r.dAdicional})` : ''}${r.bonus ? ` ${r.bonus > 0 ? '+' : '−'} ${Math.abs(r.bonus)}` : ''}`;
/* O mesmo texto de uma rolagem, para expressões que só a mesa aceita: o chat de dados do site mostra só isto. */
export function textoDaRolagem(r: DiceRollResult) {
  const partes = r.groups.map(g => {
    const selecao = g.selection ? `${g.selection}${g.selectionCount}` : '';
    const dados = g.dice.filter(d => d.kept).flatMap(d => d.rolls).join(', ');
    return `${g.sign < 0 ? '− ' : ''}${g.count}d${g.sides}${selecao}${g.exploding ? '!' : ''} (${dados})${g.modifier ? ` ${g.modifier > 0 ? '+' : '−'} ${Math.abs(g.modifier)}` : ''}`;
  });
  for (const m of r.flatModifiers) partes.push(`${m.value > 0 ? '+' : '−'} ${Math.abs(m.value)}`);
  return partes.join(' ').slice(0, 500);
}

const escopoCampanha = (campanhaId: string) => eq(rolagens.campanhaId, campanhaId);
const escopoFichaSolo = (fichaId: string) => and(isNull(rolagens.campanhaId), eq(rolagens.fichaId, fichaId))!;

/* Grava e avisa a mesa. É o único caminho de uma rolagem até o banco, venha do site ou da mesa. */
export async function gravarRolagem(d: {
  campanhaId: string | null; fichaId: string | null; usuarioId: string; autor: string; rotulo: string;
  det: string; total: number; expressao: string; detalhe: DiceRollResult;
}) {
  const linha = { id: novoId('r'), em: Date.now(), ...d };
  await db.insert(rolagens).values(linha);
  const escopo = d.campanhaId ? escopoCampanha(d.campanhaId) : escopoFichaSolo(d.fichaId!);
  const recentes = db.select({ id: rolagens.id }).from(rolagens).where(escopo).orderBy(desc(rolagens.em), desc(rolagens.id)).limit(LIMITE_ROLAGENS);
  await db.delete(rolagens).where(and(escopo, notInArray(rolagens.id, recentes)));
  if (d.campanhaId) avisarMesa({ tipo: 'rolagem', campanhaId: d.campanhaId, linha });
  return linha;
}
async function registrarRolagem(
  campanhaId: string | null, fichaId: string | null, usuario: UsuarioSessao,
  autor: string, rotulo: string, r: ReturnType<typeof rolar>, fotoV = 0,
): Promise<Mensagem> {
  const linha = await gravarRolagem({ campanhaId, fichaId, usuarioId: usuario.id, autor, rotulo, det: detalheRolagem(r), total: r.total, expressao: r.expressao, detalhe: r.detalhe });
  return { id: linha.id, em: linha.em, autor, rotulo, det: linha.det, total: r.total, minha: true, fichaId, fotoV };
}

/* Página do histórico, da mais antiga para a mais nova. `antes` é o cursor "em_id" da mensagem mais antiga já carregada. */
async function listarChat(escopo: SQL, url: string, usuarioId: string): Promise<PaginaChat> {
  const antes = new URL(url).searchParams.get('antes');
  const filtros = [escopo];
  if (antes) {
    const corte = antes.indexOf('_');
    const em = Number(antes.slice(0, corte));
    if (corte < 1 || !Number.isSafeInteger(em)) throw new Erro(400, 'Não consegui carregar as mensagens anteriores. Recarregue a página.');
    const id = antes.slice(corte + 1);
    filtros.push(or(lt(rolagens.em, em), and(eq(rolagens.em, em), lt(rolagens.id, id)))!);
  }
  const linhas = await db.select({ r: rolagens, fotoV: fichas.fotoV, campanhaDaFicha: fichas.campanhaId }).from(rolagens)
    .leftJoin(fichas, eq(rolagens.fichaId, fichas.id)).where(and(...filtros))
    .orderBy(desc(rolagens.em), desc(rolagens.id)).limit(PAGINA_CHAT + 1);
  return {
    temMais: linhas.length > PAGINA_CHAT,
    mensagens: linhas.slice(0, PAGINA_CHAT).reverse().map(({ r, fotoV, campanhaDaFicha }) => ({
      id: r.id, em: r.em, autor: r.autor, rotulo: r.rotulo, det: r.det, total: r.total,
      minha: r.usuarioId === usuarioId, fichaId: r.fichaId,
      /* Quem não tem mais acesso à foto (a ficha saiu da campanha) vê a inicial, não uma imagem quebrada. */
      fotoV: fotoV && campanhaDaFicha === r.campanhaId ? fotoV : 0,
    })),
  };
}

/* ---------- Rotas ---------- */
interface Rota { metodo: string; re: RegExp; nomes: string[]; fn: Manipulador; publica: boolean }
const rotas: Rota[] = [];
function rota(metodo: string, padrao: string, fn: Manipulador, publica = false) {
  const nomes: string[] = [];
  const re = new RegExp('^' + padrao.replace(/:(\w+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; }) + '$');
  rotas.push({ metodo, re, nomes, fn, publica });
}

/* Conta */
rota('POST', '/api/conta/cadastro', async ctx => {
  const chave = 'cadastro:' + ctx.ip;
  if (await excedeu(chave, 20)) throw muitasTentativas();
  const { nome, email, senha: s } = validar(esquemaCadastro, ctx.corpo);
  const emUso = new Erro(409, 'Já existe uma conta com esse e-mail. Entre com ela ou use outro.');
  const [existente] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email));
  if (existente) throw emUso;
  const u = { id: novoId('u'), nome, email, senhaHash: await gerarHash(s), criadoEm: Date.now() };
  /* A coluna é única: se duas pessoas se cadastrarem ao mesmo tempo, só uma grava. */
  const criado = await db.insert(usuarios).values(u).onConflictDoNothing().returning({ id: usuarios.id });
  if (!criado.length) throw emUso;
  await contar(chave, 3600 * 1000);
  ctx.cookie = cabecalhoCookie(ctx.req, await criarSessao(u.id), SESSAO_S);
  ctx.status = 201;
  return { usuario: usuarioPublico(u) };
}, true);

const HASH_FALSO = crypto.randomBytes(16).toString('hex') + ':' + crypto.randomBytes(64).toString('hex');
rota('POST', '/api/conta/entrar', async ctx => {
  const email = typeof ctx.corpo.email === 'string' ? ctx.corpo.email.trim().toLowerCase() : '';
  const s = typeof ctx.corpo.senha === 'string' ? ctx.corpo.senha.slice(0, 200) : '';
  const chaveIp = `entrar:${ctx.ip}:${email}`, chaveEmail = `entrar:${email}`;
  if (await excedeu(chaveIp, 10) || await excedeu(chaveEmail, 30)) throw muitasTentativas();
  const [u] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  /* Faz o mesmo trabalho quando o e-mail não existe, para o tempo de resposta não revelar quem tem conta. */
  const certa = await conferirHash(s, u ? u.senhaHash : HASH_FALSO);
  if (!u || !certa) {
    await contar(chaveIp);
    await contar(chaveEmail);
    throw new Erro(401, 'E-mail ou senha incorretos.');
  }
  await limparTentativa(chaveIp);
  await limparTentativa(chaveEmail);
  /* Limpeza oportunista, para a tabela não crescer sem fim. */
  await db.delete(tentativas).where(lt(tentativas.ate, Date.now()));
  ctx.cookie = cabecalhoCookie(ctx.req, await criarSessao(u.id), SESSAO_S);
  return { usuario: usuarioPublico(u) };
}, true);

rota('POST', '/api/conta/sair', async ctx => {
  if (ctx.token) await db.delete(sessoes).where(eq(sessoes.hash, hashToken(ctx.token)));
  ctx.cookie = cabecalhoCookie(ctx.req, '', 0);
  return { ok: true };
}, true);

rota('GET', '/api/conta', async ctx => ({ usuario: usuarioPublico(ctx.usuario) }));

rota('PATCH', '/api/conta', async ctx => {
  const nome = validar(nomePessoa, ctx.corpo.nome);
  await db.update(usuarios).set({ nome }).where(eq(usuarios.id, ctx.usuario.id));
  return { usuario: { ...usuarioPublico(ctx.usuario), nome } };
});

rota('POST', '/api/conta/senha', async ctx => {
  const chave = 'senha:' + ctx.usuario.id;
  if (await excedeu(chave, 10)) throw muitasTentativas();
  const nova = validar(senha, ctx.corpo.nova);
  if (!(await conferirHash(String(ctx.corpo.atual ?? '').slice(0, 200), ctx.usuario.senhaHash))) {
    await contar(chave);
    throw new Erro(400, 'A senha atual não confere.');
  }
  await db.update(usuarios).set({ senhaHash: await gerarHash(nova) }).where(eq(usuarios.id, ctx.usuario.id));
  /* Trocar a senha desconecta os outros aparelhos. */
  await apagarSessoes(ctx.usuario.id, hashToken(ctx.token!));
  return { ok: true };
});

rota('DELETE', '/api/conta', async ctx => {
  const chave = 'excluir:' + ctx.usuario.id;
  if (await excedeu(chave, 10)) throw muitasTentativas();
  if (!(await conferirHash(String(ctx.corpo.senha ?? '').slice(0, 200), ctx.usuario.senhaHash))) {
    await contar(chave);
    throw new Erro(400, 'A senha não confere. A conta não foi excluída.');
  }
  const id = ctx.usuario.id;
  for (const c of await db.select({ id: campanhas.id }).from(campanhas).where(eq(campanhas.mestreId, id))) await apagarCampanha(c.id);
  const mesasDaPessoa = await db.select({ id: membros.campanhaId }).from(membros).where(eq(membros.usuarioId, id));
  await db.batch([
    /* Nas mesas dos outros, o histórico fica, mas sem o nome e o vínculo de quem saiu. */
    db.delete(rolagens).where(and(isNull(rolagens.campanhaId), eq(rolagens.usuarioId, id))),
    db.update(rolagens).set({ autor: 'Conta removida', usuarioId: null, fichaId: null }).where(eq(rolagens.usuarioId, id)),
    db.update(mensagensMesa).set({ autor: 'Conta removida', usuarioId: null }).where(eq(mensagensMesa.usuarioId, id)),
    db.delete(membros).where(eq(membros.usuarioId, id)),
    db.delete(chavesIntegracao).where(inArray(chavesIntegracao.fichaId, db.select({ id: fichas.id }).from(fichas).where(eq(fichas.donoId, id)))),
    db.delete(fichas).where(eq(fichas.donoId, id)),
    db.delete(sessoes).where(eq(sessoes.usuarioId, id)),
    db.delete(usuarios).where(eq(usuarios.id, id)),
  ]);
  for (const m of mesasDaPessoa) avisarMesa({ tipo: 'campanha', campanhaId: m.id });
  ctx.cookie = cabecalhoCookie(ctx.req, '', 0);
  return { ok: true };
});

/* Fichas */
rota('GET', '/api/fichas', async ctx => {
  const linhas = await db.select(colunasFicha).from(fichas).where(eq(fichas.donoId, ctx.usuario.id)).orderBy(desc(fichas.atualizado));
  return { fichas: await Promise.all(linhas.map(f => comContexto(f, ctx.usuario))) };
});

rota('GET', '/api/fichas/exportar', async ctx => {
  const linhas = await db.select().from(fichas).where(eq(fichas.donoId, ctx.usuario.id));
  return { sistema: 'One History', fichas: linhas.map(f => ({ ...f.dados, foto: f.foto ?? '', registro: f.registro })) };
});

function respostaFoto(foto: string, cache: string) {
  const [cabeca, base64] = foto.split(',');
  const tipo = cabeca.slice(5).split(';')[0];
  return new Response(Buffer.from(base64, 'base64'), { headers: { 'Content-Type': tipo, 'Cache-Control': cache } });
}
function fotoDaEntrada(foto: unknown) {
  if (foto === '' || foto === undefined || foto === null) return null;
  if (typeof foto !== 'string' || foto.length > LIMITE_FOTO || !FOTO_VALIDA.test(foto)) throw new Erro(400, 'Essa foto não pôde ser salva. Use um JPG, PNG ou WebP menor.');
  return foto;
}

rota('POST', '/api/fichas', async ctx => {
  const [{ n }] = await db.select({ n: count() }).from(fichas).where(eq(fichas.donoId, ctx.usuario.id));
  if (n >= LIMITE_FICHAS) throw new Erro(400, `Sua conta chegou ao limite de ${LIMITE_FICHAS} fichas. Apague alguma para criar outra.`);
  /* Quem cria ou importa uma ficha ainda não tem mestre: um arquivo editado não pode trazer núcleo, bônus nem passar dos SP. */
  const dados = R.normalizar({ ...ctx.corpo.dados, ajustes: undefined, limites: undefined, nucleo: undefined, publica: undefined });
  R.aplicarTravasDoJogador(dados, R.normalizar({}));
  if (!dados.player) dados.player = ctx.usuario.nome;
  const foto = fotoDaEntrada(ctx.corpo.dados?.foto);
  const agora = Date.now();
  const linha = { id: novoId('f'), donoId: ctx.usuario.id, campanhaId: null, dados, registro: [], foto, fotoV: foto ? agora : 0, criadoEm: agora, atualizado: agora };
  await db.insert(fichas).values(linha);
  ctx.status = 201;
  return { ficha: await comContexto(linha, ctx.usuario) };
});

/* O resumo que a mesa mostra: mesma permissão de abrir a ficha. */
rota('GET', '/api/fichas/:id/resumo', async ctx => resumoDaFicha(await fichaEditavel(ctx.params.id, ctx.usuario)));

rota('GET', '/api/fichas/:id', async ctx => ({ ficha: await comContexto(await fichaEditavel(ctx.params.id, ctx.usuario), ctx.usuario) }));

async function fotoLiberada(f: { donoId: string; dados: R.DadosFicha }, campanhaId: string, usuarioId: string) {
  const [c] = await db.select({ mestreId: campanhas.mestreId }).from(campanhas).where(eq(campanhas.id, campanhaId));
  return c?.mestreId === usuarioId || !R.fichaPrivada(f, c?.mestreId ?? '');
}
rota('GET', '/api/fichas/:id/foto', async ctx => {
  const [f] = await db.select({ foto: fichas.foto, donoId: fichas.donoId, campanhaId: fichas.campanhaId, dados: fichas.dados }).from(fichas).where(eq(fichas.id, ctx.params.id));
  const pode = f && (f.donoId === ctx.usuario.id || (f.campanhaId && await papelEm(f.campanhaId, ctx.usuario.id) && await fotoLiberada(f, f.campanhaId, ctx.usuario.id)));
  if (!pode || !f.foto) throw new Erro(404, 'Foto não encontrada.');
  return respostaFoto(f.foto, 'private, max-age=31536000, immutable');
});

rota('PATCH', '/api/fichas/:id', async ctx => {
  const souMestre = await mestreDaFicha(await fichaEditavel(ctx.params.id, ctx.usuario), ctx.usuario);
  const extras: Partial<typeof fichas.$inferInsert> = {};
  if ('foto' in ctx.corpo) {
    extras.foto = fotoDaEntrada(ctx.corpo.foto);
    extras.fotoV = extras.foto ? Date.now() : 0;
  }
  const f = await alterarFicha(ctx.params.id, l => {
    const base: Record<string, any> = { ...l.dados };
    for (const [k, v] of Object.entries(ctx.corpo)) {
      /* Em campanha, a fadiga é decisão do mestre. Fora dela, não há mestre, e quem cuida é o dono. */
      if (k === 'fadiga' && l.campanhaId && !souMestre) continue;
      const ehObjeto = v && typeof v === 'object';
      if (k in R.GRUPOS && ehObjeto) base[k] = { ...base[k], ...v };
      else if (CAMPOS_MESTRE.has(k)) { if (souMestre) base[k] = ehObjeto ? { ...base[k], ...v } : v; }
      else if (CAMPOS_FICHA.has(k)) base[k] = v;
    }
    const nova = R.normalizar(base);
    if (!souMestre) R.aplicarTravasDoJogador(nova, R.normalizar(l.dados));
    l.dados = R.normalizar(nova);
  }, extras);
  return { ficha: await comContexto(f, ctx.usuario) };
});

rota('DELETE', '/api/fichas/:id', async ctx => {
  const f = await fichaDoDono(ctx.params.id, ctx.usuario);
  await db.batch([
    db.delete(rolagens).where(escopoFichaSolo(f.id)),
    db.delete(chavesIntegracao).where(eq(chavesIntegracao.fichaId, f.id)),
    db.delete(fichas).where(eq(fichas.id, f.id)),
  ]);
  if (f.campanhaId) avisarMesa({ tipo: 'campanha', campanhaId: f.campanhaId });
  return { ok: true };
});

rota('POST', '/api/fichas/:id/encerrar-cena', async ctx => {
  await fichaEditavel(ctx.params.id, ctx.usuario);
  let mensagem = '';
  const f = await alterarFicha(ctx.params.id, l => {
    const r = R.aplicarFimDeCena(l.dados);
    mensagem = r.perda
      ? `Cena encerrada em ${l.dados.fadiga}%: −${r.perda} de mana total (${r.pct}% de ${r.totalAntes}, agora ${r.totalDepois})`
      : `Cena encerrada em ${l.dados.fadiga}%: sem perda de mana`;
    l.registro = [{ em: Date.now(), txt: mensagem }, ...l.registro].slice(0, 12);
  });
  return { ficha: await comContexto(f, ctx.usuario), mensagem };
});

rota('POST', '/api/fichas/:id/rolar', async ctx => {
  const f = await fichaEditavel(ctx.params.id, ctx.usuario);
  let rotulo = '';
  let r: ReturnType<typeof rolar>;
  if (ctx.corpo.atributo) {
    /* Rolagem de atributo é sempre d20 + o valor guardado na ficha, e a de perícia soma o dado adicional: o navegador não escolhe o bônus. */
    const item = lerAcao(R.normalizar(f.dados), String(ctx.corpo.atributo));
    if (!item) throw new Erro(400, 'Esse atributo não existe na ficha.');
    rotulo = item.rotulo;
    const { valor } = item;
    r = rolar(20, valor, item.grupo === 'pericias' ? R.dadoAdicional(valor) : 0);
  } else {
    r = rolar(Number(ctx.corpo.lados), R.inteiro(ctx.corpo.bonus, -999, 999));
  }
  const [campanha] = f.campanhaId ? await db.select({ mestreId: campanhas.mestreId }).from(campanhas).where(eq(campanhas.id, f.campanhaId)) : [];
  /* Todos da mesa veem a rolagem: o nome, a foto e o id entregariam a ficha privada. */
  if (campanha && R.fichaPrivada(f, campanha.mestreId)) return { rolagem: await registrarRolagem(f.campanhaId, null, ctx.usuario, 'Mestre', rotulo, r) };
  return { rolagem: await registrarRolagem(f.campanhaId, f.id, ctx.usuario, nomeFicha(f.dados), rotulo, r, f.fotoV) };
});

/* Chat de uma ficha fora de campanha: só o dono vê. Em campanha, o chat é o da mesa. */
rota('GET', '/api/fichas/:id/chat', async ctx => {
  const f = await fichaDoDono(ctx.params.id, ctx.usuario);
  return listarChat(escopoFichaSolo(f.id), ctx.req.url, ctx.usuario.id);
});

/* Campanhas */
rota('GET', '/api/campanhas', async ctx => {
  const minhas = await db.select({ c: campanhas, papel: membros.papel }).from(membros)
    .innerJoin(campanhas, eq(membros.campanhaId, campanhas.id)).where(eq(membros.usuarioId, ctx.usuario.id));
  const nomes = await nomesDe(minhas.map(m => m.c.mestreId));
  const resumos = await Promise.all(minhas.map(async ({ c, papel }) => {
    const [{ n: jogadores }] = await db.select({ n: count() }).from(membros).where(and(eq(membros.campanhaId, c.id), eq(membros.papel, 'jogador')));
    /* A contagem também não pode revelar que o mestre tem fichas privadas. */
    const visiveis = papel === 'mestre' ? undefined : sql`(${fichas.donoId} <> ${c.mestreId} or json_extract(${fichas.dados}, '$.publica') = 1)`;
    const [{ n: qtdFichas }] = await db.select({ n: count() }).from(fichas).where(and(eq(fichas.campanhaId, c.id), visiveis));
    return { id: c.id, nome: c.nome, descricao: c.descricao, papel, mestreNome: nomes.get(c.mestreId) ?? 'Conta removida', jogadores, fichas: qtdFichas };
  }));
  return { mestre: resumos.filter(c => c.papel === 'mestre'), jogador: resumos.filter(c => c.papel === 'jogador') };
});

rota('POST', '/api/campanhas', async ctx => {
  const dados = validar(esquemaCampanha, ctx.corpo);
  const [{ n }] = await db.select({ n: count() }).from(campanhas).where(eq(campanhas.mestreId, ctx.usuario.id));
  if (n >= LIMITE_CAMPANHAS) throw new Erro(400, `Você chegou ao limite de ${LIMITE_CAMPANHAS} campanhas como mestre. Exclua alguma para criar outra.`);
  const id = novoId('c'), agora = Date.now();
  await db.batch([
    db.insert(campanhas).values({ id, ...dados, mestreId: ctx.usuario.id, codigo: await gerarCodigo(), criadoEm: agora }),
    db.insert(membros).values({ campanhaId: id, usuarioId: ctx.usuario.id, papel: 'mestre', entrouEm: agora }),
  ]);
  ctx.status = 201;
  return { campanha: { id } };
});

rota('GET', '/api/campanhas/:id', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  const souMestre = c.mestreId === ctx.usuario.id;
  const listaMembros = await db.select().from(membros).where(eq(membros.campanhaId, c.id));
  const todasFichas = await db.select(colunasFicha).from(fichas).where(eq(fichas.campanhaId, c.id));
  const linhasFichas = souMestre ? todasFichas : todasFichas.filter(f => !R.fichaPrivada(f, c.mestreId));
  const nomes = await nomesDe([...listaMembros.map(m => m.usuarioId), ...linhasFichas.map(f => f.donoId), c.mestreId]);
  const livres = await db.select({ id: fichas.id, dados: fichas.dados }).from(fichas)
    .where(and(eq(fichas.donoId, ctx.usuario.id), isNull(fichas.campanhaId)));
  return {
    campanha: {
      id: c.id, nome: c.nome, descricao: c.descricao, mestreId: c.mestreId, mestreNome: nomes.get(c.mestreId) ?? 'Conta removida',
      ...(souMestre ? { codigo: c.codigo } : {}),
    },
    papel: souMestre ? 'mestre' : 'jogador',
    membros: listaMembros.map(m => ({ id: m.usuarioId, nome: nomes.get(m.usuarioId) ?? 'Conta removida', papel: m.papel })),
    fichas: linhasFichas.sort((a, b) => a.dados.nome.localeCompare(b.dados.nome)).map(f => resumoFicha(f, ctx.usuario.id, c.mestreId, nomes)),
    minhasLivres: livres.map(f => ({ id: f.id, nome: nomeFicha(f.dados) })),
  };
});

rota('PATCH', '/api/campanhas/:id', async ctx => {
  const c = await campanhaDoMestre(ctx.params.id, ctx.usuario);
  await db.update(campanhas).set(validar(esquemaCampanha, ctx.corpo)).where(eq(campanhas.id, c.id));
  return { ok: true };
});

rota('DELETE', '/api/campanhas/:id', async ctx => {
  await apagarCampanha((await campanhaDoMestre(ctx.params.id, ctx.usuario)).id);
  return { ok: true };
});

rota('POST', '/api/campanhas/:id/codigo', async ctx => {
  const c = await campanhaDoMestre(ctx.params.id, ctx.usuario);
  const codigo = await gerarCodigo();
  await db.update(campanhas).set({ codigo }).where(eq(campanhas.id, c.id));
  return { codigo };
});

rota('POST', '/api/campanhas/:id/rolar', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  const r = rolar(Number(ctx.corpo.lados), R.inteiro(ctx.corpo.bonus, -999, 999));
  return { rolagem: await registrarRolagem(c.id, null, ctx.usuario, ctx.usuario.nome, '', r) };
});

rota('GET', '/api/campanhas/:id/chat', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  return listarChat(escopoCampanha(c.id), ctx.req.url, ctx.usuario.id);
});

rota('POST', '/api/campanhas/:id/fichas', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  const f = await fichaDoDono(String(ctx.corpo.fichaId), ctx.usuario);
  if (f.campanhaId && f.campanhaId !== c.id) {
    const [outra] = await db.select({ nome: campanhas.nome }).from(campanhas).where(eq(campanhas.id, f.campanhaId));
    throw new Erro(409, `Essa ficha já está em “${outra?.nome}”. Retire-a de lá primeiro.`);
  }
  /* Com a ficha já aqui, o valor guardado está velho: restaurá-lo desfaria o que o mestre mudou depois. */
  if (f.campanhaId === c.id) return { ok: true };
  const [{ guardadas }] = await db.select({ guardadas: fichas.fadigasCampanha }).from(fichas).where(eq(fichas.id, f.id));
  const guardada = guardadas[c.id];
  await alterarFicha(f.id, l => {
    if (guardada !== undefined && guardada !== l.dados.fadiga) {
      l.registro = [{ em: Date.now(), txt: `De volta à campanha: fadiga restaurada para ${guardada}%` }, ...l.registro].slice(0, 12);
    }
    l.dados = R.normalizar({ ...l.dados, fadiga: guardada ?? l.dados.fadiga });
    l.campanhaId = c.id;
  }, { campanhaId: c.id });
  avisarMesa({ tipo: 'campanha', campanhaId: c.id });
  return { ok: true };
});

rota('DELETE', '/api/campanhas/:id/fichas/:fichaId', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  const [f] = await db.select(colunasFicha).from(fichas).where(eq(fichas.id, ctx.params.fichaId));
  if (!f || f.campanhaId !== c.id) throw new Erro(404, 'Essa ficha não está nesta campanha.');
  if (f.donoId !== ctx.usuario.id && c.mestreId !== ctx.usuario.id) throw new Erro(403, 'Só o dono da ficha ou o mestre pode retirá-la da campanha.');
  await soltarFichas(c.id, eq(fichas.id, f.id));
  avisarMesa({ tipo: 'campanha', campanhaId: c.id });
  return { ok: true };
});

rota('DELETE', '/api/campanhas/:id/membros/:usuarioId', async ctx => {
  const c = await campanhaDoMembro(ctx.params.id, ctx.usuario);
  const alvo = ctx.params.usuarioId;
  if (alvo !== ctx.usuario.id && c.mestreId !== ctx.usuario.id) throw new Erro(403, 'Só o mestre pode remover outros jogadores.');
  if (alvo === c.mestreId) throw new Erro(400, 'O mestre não pode sair da própria campanha. Exclua a campanha, se for o caso.');
  if (!(await papelEm(c.id, alvo))) throw new Erro(404, 'Essa pessoa não está na campanha.');
  await removerMembro(c.id, alvo);
  return { ok: true };
});

/* Convites */
async function campanhaDoConvite(ctx: Ctx) {
  const chave = 'convite:' + ctx.usuario.id;
  if (await excedeu(chave, 20)) throw muitasTentativas();
  const [c] = await db.select().from(campanhas).where(eq(campanhas.codigo, ctx.params.codigo.toUpperCase()));
  if (!c) {
    await contar(chave);
    throw new Erro(404, 'Esse código não abre nenhuma campanha. Confira com o mestre: ele pode ter gerado um novo.');
  }
  return c;
}
rota('GET', '/api/convites/:codigo', async ctx => {
  const c = await campanhaDoConvite(ctx);
  return {
    campanha: { id: c.id, nome: c.nome, descricao: c.descricao, mestreNome: await nomeDe(c.mestreId) },
    jaParticipa: !!(await papelEm(c.id, ctx.usuario.id)),
  };
});
rota('POST', '/api/convites/:codigo/entrar', async ctx => {
  const c = await campanhaDoConvite(ctx);
  if (!(await papelEm(c.id, ctx.usuario.id))) {
    const [{ n }] = await db.select({ n: count() }).from(membros).where(eq(membros.campanhaId, c.id));
    if (n >= LIMITE_MEMBROS) throw new Erro(400, 'Essa campanha está cheia. Fale com o mestre.');
    await db.insert(membros).values({ campanhaId: c.id, usuarioId: ctx.usuario.id, papel: 'jogador', entrouEm: Date.now() }).onConflictDoNothing();
    avisarMesa({ tipo: 'campanha', campanhaId: c.id });
  }
  return { campanha: { id: c.id } };
});

/* ---------- Atendimento ---------- */
function conferirOrigem(req: Request) {
  /* Bloqueia pedidos forjados por outros sites: além do cookie SameSite, exige JSON e mesma origem. */
  if (!/^application\/json/i.test(req.headers.get('content-type') || '')) throw new Erro(415, 'Envie os dados em JSON.');
  const origem = req.headers.get('origin');
  if (!origem) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let hostOrigem: string | null = null;
  try { hostOrigem = new URL(origem).host; } catch { /* origem malformada cai na recusa abaixo */ }
  if (hostOrigem !== host) throw new Erro(403, 'Pedido recusado: origem diferente do site.');
}
async function lerCorpo(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > LIMITE_CORPO) throw new Erro(413, 'O envio é grande demais.');
  const bruto = await req.text();
  if (bruto.length > LIMITE_CORPO) throw new Erro(413, 'O envio é grande demais.');
  if (!bruto) return {};
  try {
    const o = JSON.parse(bruto);
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0;
    return o as Record<string, any>;
  } catch { throw new Erro(400, 'Os dados enviados não estão em um formato válido.'); }
}
function responderJson(status: number, obj: unknown, cookie?: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(obj), { status, headers });
}
function lerCookie(req: Request) {
  for (const parte of (req.headers.get('cookie') || '').split(';')) {
    const [k, v] = parte.trim().split('=');
    if (k === COOKIE) return v;
  }
  return undefined;
}

export async function atender(req: Request): Promise<Response> {
  try {
    const caminho = new URL(req.url).pathname;
    let encontrada: { r: Rota; m: RegExpMatchArray } | null = null;
    for (const r of rotas) {
      const m = r.metodo === req.method ? caminho.match(r.re) : null;
      if (m) { encontrada = { r, m }; break; }
    }
    if (!encontrada) throw new Erro(404, 'Rota não encontrada.');
    const { r, m } = encontrada;
    let corpo: Record<string, any> = {};
    if (req.method !== 'GET') { conferirOrigem(req); corpo = await lerCorpo(req); }
    const token = lerCookie(req);
    const usuario = await usuarioDoToken(token);
    if (!r.publica && !usuario) throw new Erro(401, 'Entre na sua conta para continuar.');
    const ctx: Ctx = {
      req, corpo, token, usuario: usuario!, status: 200, cookie: null,
      params: Object.fromEntries(r.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])])),
      /* Melhor esforço: atrás de proxy este cabeçalho pode vir do cliente, por isso o login também limita por e-mail. */
      ip: (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim(),
    };
    const saida = await r.fn(ctx);
    return saida instanceof Response ? saida : responderJson(ctx.status, saida, ctx.cookie);
  } catch (e) {
    if (e instanceof Erro) return responderJson(e.status, { erro: e.message });
    if (e instanceof URIError) return responderJson(400, { erro: 'Endereço inválido.' });
    console.error(e);
    return responderJson(500, { erro: 'Algo deu errado no servidor. Tente de novo em instantes.' });
  }
}
