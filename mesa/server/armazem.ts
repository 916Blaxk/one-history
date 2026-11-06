import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import type { DiceRollResult } from '../src/features/chat/dice-types.js'
import type { ChatMessage, ChatMessageType } from '../src/features/chat/chat-types.js'
import type { Token, TokenSprite } from '../src/features/tokens/token-types.js'
import type { Combate, NevoaDaMesa, RoomGrid, RoomScene } from '../src/shared/room-protocol.js'
import * as R from '../../lib/regras'
import type { LinhaRolagem } from '../../lib/servidor/barramento'
import { db } from '../../lib/servidor/db'
import { campanhas, fichas, membros, mensagensMesa, mesaImagens, mesas, rolagens, usuarios } from '../../lib/servidor/schema'

const LIMITE_HISTORICO = 200
const LIMITE_MENSAGENS = 500

/* Quem pode entrar é decidido aqui, sempre pelo banco. O navegador não informa papel nenhum. */
export async function lerAcesso(campanhaId: string, usuarioId: string) {
  const [linha] = await db.select({ mestreId: campanhas.mestreId, papel: membros.papel }).from(membros)
    .innerJoin(campanhas, eq(membros.campanhaId, campanhas.id))
    .where(and(eq(membros.campanhaId, campanhaId), eq(membros.usuarioId, usuarioId)))
  return linha ?? null
}

export async function lerMembros(campanhaId: string) {
  return db.select({ id: usuarios.id, nome: usuarios.nome, papel: membros.papel }).from(membros)
    .innerJoin(usuarios, eq(membros.usuarioId, usuarios.id)).where(eq(membros.campanhaId, campanhaId))
}

export async function campanhaExiste(campanhaId: string) {
  const [c] = await db.select({ mestreId: campanhas.mestreId }).from(campanhas).where(eq(campanhas.id, campanhaId))
  return c ?? null
}

export async function lerFicha(fichaId: string) {
  const [f] = await db.select({ id: fichas.id, donoId: fichas.donoId, campanhaId: fichas.campanhaId, dados: fichas.dados, fotoV: fichas.fotoV }).from(fichas).where(eq(fichas.id, fichaId))
  return f ? { ...f, dados: R.normalizar(f.dados) } : null
}

export async function lerFichasDaCampanha(campanhaId: string) {
  const linhas = await db.select({ id: fichas.id, donoId: fichas.donoId, campanhaId: fichas.campanhaId, dados: fichas.dados, fotoV: fichas.fotoV }).from(fichas).where(eq(fichas.campanhaId, campanhaId))
  return linhas.map((f) => ({ ...f, dados: R.normalizar(f.dados) }))
}

export function rolagemParaChat(l: LinhaRolagem): ChatMessage {
  return {
    id: l.id, type: 'roll', author: l.autor, timestamp: l.em,
    /* Rolagem antiga não tem os dados um a um: aparece como texto. */
    text: l.detalhe ? String(l.expressao ?? l.det) : `${l.det} = ${l.total}`,
    label: l.rotulo || undefined,
    roll: (l.detalhe ?? undefined) as DiceRollResult | undefined,
  }
}

export async function carregarHistorico(campanhaId: string) {
  const [linhasRolagens, linhasMensagens] = await Promise.all([
    db.select().from(rolagens).where(eq(rolagens.campanhaId, campanhaId)).orderBy(desc(rolagens.em), desc(rolagens.id)).limit(LIMITE_HISTORICO),
    db.select().from(mensagensMesa).where(eq(mensagensMesa.campanhaId, campanhaId)).orderBy(desc(mensagensMesa.em), desc(mensagensMesa.id)).limit(LIMITE_MENSAGENS),
  ])
  const publicas: ChatMessage[] = linhasRolagens.map(rolagemParaChat)
  const privadas = new Map<string, ChatMessage[]>()
  for (const m of linhasMensagens) {
    const mensagem: ChatMessage = {
      id: m.id, type: m.tipo as ChatMessageType, author: m.autor, text: m.texto,
      recipient: m.destinatario ?? undefined, timestamp: m.em,
    }
    if (!m.visivelPara) { publicas.push(mensagem); continue }
    for (const id of m.visivelPara) privadas.set(id, [...(privadas.get(id) ?? []), mensagem])
  }
  const ordenar = (lista: ChatMessage[]) => [...lista].sort((a, b) => a.timestamp - b.timestamp).slice(-LIMITE_HISTORICO)
  return { publicas: ordenar(publicas), privadas: new Map([...privadas].map(([id, lista]) => [id, ordenar(lista)])) }
}

export async function gravarMensagem(campanhaId: string, usuarioId: string, m: ChatMessage, visivelPara: string[] | null) {
  await db.insert(mensagensMesa).values({
    id: m.id, campanhaId, usuarioId, autor: m.author, tipo: m.type, texto: m.text,
    destinatario: m.recipient ?? null, visivelPara, em: m.timestamp,
  })
  const recentes = db.select({ id: mensagensMesa.id }).from(mensagensMesa).where(eq(mensagensMesa.campanhaId, campanhaId))
    .orderBy(desc(mensagensMesa.em), desc(mensagensMesa.id)).limit(LIMITE_MENSAGENS)
  await db.delete(mensagensMesa).where(and(eq(mensagensMesa.campanhaId, campanhaId), notInArray(mensagensMesa.id, recentes)))
}

/* O que fica em `mesas.estado`: tudo menos as imagens, que têm linha própria e não mudam depois de criadas. */
export interface EstadoMesa {
  tokens: Token[]
  sprites: Record<string, Omit<TokenSprite, 'imageUrl'>[]>
  grid: RoomGrid
  scenes: Omit<RoomScene, 'imageUrl'>[]
  nevoa?: NevoaDaMesa
  /* Só em mesas salvas antes do pincel livre: é convertido ao carregar. */
  fogCells?: string[]
  espectadores: string[]
  /* Fichas que já tiveram token: é o que impede um token apagado de voltar sozinho. */
  fichasComToken?: string[]
  combate?: Combate | null
}

export async function carregarMesa(campanhaId: string) {
  const [linha] = await db.select({ estado: mesas.estado }).from(mesas).where(eq(mesas.campanhaId, campanhaId))
  if (!linha) return null
  const imagens = await db.select({ id: mesaImagens.id, dados: mesaImagens.dados }).from(mesaImagens).where(eq(mesaImagens.campanhaId, campanhaId))
  return { estado: linha.estado as EstadoMesa, imagens: new Map(imagens.map(i => [i.id, i.dados])) }
}

/* Devolve os ids de imagem agora salvos, para o próximo salvamento enviar só as novas. */
export async function salvarMesa(campanhaId: string, estado: EstadoMesa, imagens: Map<string, string>, jaSalvas: ReadonlySet<string>) {
  const novas = [...imagens].filter(([id]) => !jaSalvas.has(id))
  const removidas = [...jaSalvas].filter(id => !imagens.has(id))
  const agora = Date.now()
  /* Uma imagem por vez: juntas, poderiam passar do limite de tamanho de um pedido no Turso. */
  for (const [id, dados] of novas) {
    await db.insert(mesaImagens).values({ campanhaId, id, dados }).onConflictDoUpdate({ target: [mesaImagens.campanhaId, mesaImagens.id], set: { dados } })
  }
  if (removidas.length) await db.delete(mesaImagens).where(and(eq(mesaImagens.campanhaId, campanhaId), inArray(mesaImagens.id, removidas)))
  await db.insert(mesas).values({ campanhaId, estado, atualizado: agora }).onConflictDoUpdate({
    target: mesas.campanhaId, set: { estado: sql`excluded.estado`, atualizado: agora },
  })
  return new Set(imagens.keys())
}
