import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Enquadramento } from '../enquadramento';
import type { DadosFicha } from '../regras';
import type { EntradaRegistro, Papel } from '../tipos';

export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  criadoEm: integer('criado_em').notNull(),
});

/* Guarda só o hash do token: quem ler o banco não consegue se passar por ninguém. */
export const sessoes = sqliteTable('sessoes', {
  hash: text('hash').primaryKey(),
  usuarioId: text('usuario_id').notNull(),
  expira: integer('expira').notNull(),
}, t => [index('sessoes_usuario').on(t.usuarioId)]);

export const fichas = sqliteTable('fichas', {
  id: text('id').primaryKey(),
  donoId: text('dono_id').notNull(),
  campanhaId: text('campanha_id'),
  /* Atributos e estado da ficha, sempre passados por normalizar() antes de gravar. */
  dados: text('dados', { mode: 'json' }).$type<DadosFicha>().notNull(),
  registro: text('registro', { mode: 'json' }).$type<EntradaRegistro[]>().notNull(),
  /* Fadiga com que a ficha saiu de cada campanha. Fora de `dados` porque não pode vir do cliente nem chegar a ele. */
  fadigasCampanha: text('fadigas_campanha', { mode: 'json' }).$type<Record<string, number>>().notNull().default({}),
  /* Foto fica fora de `dados`: a mesa é atualizada a cada poucos segundos e não pode trafegar imagens toda vez. */
  foto: text('foto'),
  /* A imagem antes do ajuste e o enquadramento usado: é o que permite reajustar sem enviar de novo. Vazios em fotos antigas. */
  fotoOriginal: text('foto_original'),
  fotoAjuste: text('foto_ajuste', { mode: 'json' }).$type<Enquadramento>(),
  fotoV: integer('foto_v').notNull().default(0),
  criadoEm: integer('criado_em').notNull(),
  atualizado: integer('atualizado').notNull(),
}, t => [index('fichas_dono').on(t.donoId), index('fichas_campanha').on(t.campanhaId)]);

export const campanhas = sqliteTable('campanhas', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  descricao: text('descricao').notNull(),
  mestreId: text('mestre_id').notNull(),
  codigo: text('codigo').notNull().unique(),
  criadoEm: integer('criado_em').notNull(),
});

export const membros = sqliteTable('membros', {
  campanhaId: text('campanha_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  papel: text('papel').$type<Papel>().notNull(),
  entrouEm: integer('entrou_em').notNull(),
}, t => [primaryKey({ columns: [t.campanhaId, t.usuarioId] }), index('membros_usuario').on(t.usuarioId)]);

/* O histórico do chat de dados. Com campanha, todos da mesa veem. Sem campanha, é só do dono da ficha. */
export const rolagens = sqliteTable('rolagens', {
  id: text('id').primaryKey(),
  campanhaId: text('campanha_id'),
  fichaId: text('ficha_id'),
  usuarioId: text('usuario_id'),
  em: integer('em').notNull(),
  /* Nome da época da rolagem: renomear a ficha depois não reescreve o histórico. */
  autor: text('autor').notNull(),
  rotulo: text('rotulo').notNull().default(''),
  det: text('det').notNull(),
  total: integer('total').notNull(),
  /* Vazios nas rolagens antigas: a mesa as mostra como texto, sem os dados um a um. */
  expressao: text('expressao'),
  detalhe: text('detalhe', { mode: 'json' }).$type<unknown>(),
}, t => [index('rolagens_campanha').on(t.campanhaId, t.em), index('rolagens_ficha').on(t.fichaId, t.em)]);

/* O chat de texto da mesa. As rolagens ficam em `rolagens`, para o chat de dados do site continuar vendo todas. */
export const mensagensMesa = sqliteTable('mensagens_mesa', {
  id: text('id').primaryKey(),
  campanhaId: text('campanha_id').notNull(),
  usuarioId: text('usuario_id'),
  autor: text('autor').notNull(),
  tipo: text('tipo').notNull(),
  texto: text('texto').notNull(),
  destinatario: text('destinatario'),
  /* Sussurro e mensagem ao mestre: só estas contas leem. Vazio: toda a mesa. */
  visivelPara: text('visivel_para', { mode: 'json' }).$type<string[]>(),
  em: integer('em').notNull(),
}, t => [index('mensagens_mesa_campanha').on(t.campanhaId, t.em)]);

/* Tokens, grade, névoa e cenários de cada campanha. As imagens ficam à parte: cada salvamento não pode reescrever todas. */
export const mesas = sqliteTable('mesas', {
  campanhaId: text('campanha_id').primaryKey(),
  estado: text('estado', { mode: 'json' }).$type<unknown>().notNull(),
  atualizado: integer('atualizado').notNull(),
});

export const mesaImagens = sqliteTable('mesa_imagens', {
  campanhaId: text('campanha_id').notNull(),
  id: text('id').notNull(),
  dados: text('dados').notNull(),
}, t => [primaryKey({ columns: [t.campanhaId, t.id] })]);

/* Sem uso desde a unificação com a mesa. Fica no banco porque as migrações são só aditivas. */
export const chavesIntegracao = sqliteTable('chaves_integracao', {
  id: text('id').primaryKey(),
  fichaId: text('ficha_id').notNull(),
  hash: text('hash').notNull().unique(),
  rotulo: text('rotulo').notNull(),
  criadoEm: integer('criado_em').notNull(),
}, t => [index('chaves_integracao_ficha').on(t.fichaId)]);

/* No banco, e não na memória, para o limite valer mesmo com várias instâncias do servidor. */
export const tentativas = sqliteTable('tentativas', {
  chave: text('chave').primaryKey(),
  n: integer('n').notNull(),
  ate: integer('ate').notNull(),
});

export type VagaMonstro = 'normal' | 'machucado' | 'armado';
export type ImagemMonstro = { rotulo: string; imagem: string };
/* O que o token precisa para nascer igual. Vida e mana guardam só o máximo: cada cópia começa cheia. */
export type DadosMonstro = { tamanho: number; altura?: number; cor: string; espelhado: boolean; vidaMax?: number; manaMax?: number };

/* A biblioteca de monstros é do mestre, não da campanha: o mesmo goblin serve em todas as mesas dele. */
export const monstros = sqliteTable('monstros', {
  id: text('id').primaryKey(),
  donoId: text('dono_id').notNull(),
  nome: text('nome').notNull(),
  dados: text('dados', { mode: 'json' }).$type<DadosMonstro>().notNull(),
  imagens: text('imagens', { mode: 'json' }).$type<Partial<Record<VagaMonstro, ImagemMonstro>>>().notNull(),
  criadoEm: integer('criado_em').notNull(),
  atualizado: integer('atualizado').notNull(),
}, t => [index('monstros_dono').on(t.donoId)]);
