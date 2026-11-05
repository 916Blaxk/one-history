import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
  /* Foto fica fora de `dados`: a mesa é atualizada a cada poucos segundos e não pode trafegar imagens toda vez. */
  foto: text('foto'),
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
}, t => [index('rolagens_campanha').on(t.campanhaId, t.em), index('rolagens_ficha').on(t.fichaId, t.em)]);

/* Chaves que o dono cria para o Tablebola ler a ficha. Guarda só o hash: quem ler o banco não consegue usar a chave. */
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
