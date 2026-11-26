/* Resumo leve da ficha usado na mesa: vida, mana, rolagens prontas e magias. Roda no navegador e no servidor. */
import * as R from './regras';
import type { DanoDaRolagem } from './tipos';

export interface AcaoRolagem { id: string; grupo: R.Grupo; categoria: string; rotulo: string; valor: number; expressao: string }
export interface Recurso { id: 'vida' | 'mana'; rotulo: string; atual: number; max: number }
export interface MagiaResumo { id: string; nome: string; elemento: string; custo: number; dano: string }
export interface ResumoDaFicha {
  id: string; nome: string; atualizado: number; fotoV: number;
  recursos: Recurso[]; acoes: AcaoRolagem[]; magias: MagiaResumo[]; fadiga: number;
}

const NOME_GRUPO: Record<R.Grupo, string> = { elementos: 'Elementos', armas: 'Armas', corpo: 'Corpo', mente: 'Mente', pericias: 'Perícias' };
const CATEGORIA_PERICIA = new Map(R.PERICIAS.flatMap(c => c.itens.map(([k]) => [k, c.categoria] as const)));

/* Cada vantagem rola mais um d20, e fica o maior. O valor da ficha soma no resultado. */
export function expressaoDaRolagem(valor: number, vantagem = 0) {
  const dados = vantagem > 0 ? `${vantagem + 1}d20kh1` : '1d20';
  if (valor > 0) return `${dados}+${valor}`;
  return valor < 0 ? `${dados}-${-valor}` : dados;
}

/* Aceita só "grupo.item" que exista: o texto vem do navegador. */
export function itemDaAcao(acao: string) {
  const [g, k] = acao.split('.') as [R.Grupo, string];
  if (!Object.prototype.hasOwnProperty.call(R.GRUPOS, g)) return null;
  const item = (R.GRUPOS[g] as readonly (readonly string[])[]).find(i => i[0] === k);
  return item ? { grupo: g, chave: k, rotulo: item[1] } : null;
}

/* O que a rolagem usa, sempre do que está guardado na ficha. Elemento criado não existe em GRUPOS: cada ficha tem os seus. */
export function lerAcao(d: R.DadosFicha, acao: string) {
  if (acao.startsWith('criados.')) {
    const criado = d.elementosCriados.find(e => R.chaveCriado(e.id) === acao);
    return criado ? { grupo: 'elementos' as const, rotulo: criado.nome, valor: R.somaDosPontos(criado.valor), vantagem: R.vantagemDosPontos(criado.valor) } : null;
  }
  const item = itemDaAcao(acao);
  if (!item) return null;
  return {
    grupo: item.grupo, rotulo: item.rotulo,
    valor: R.somaDaRolagem(d, item.grupo, item.chave),
    vantagem: R.vantagemDaRolagem(d, item.grupo, item.chave),
  };
}

/* O dano é texto livre: o mesmo limite de dados vale na ficha e na mesa. */
export const LIMITE_DADOS_DANO = 10;
export const danoNoLimite = (expressao: string) => (expressao.match(/[dD]/g)?.length ?? 0) <= LIMITE_DADOS_DANO;

const nomeDaArma = (a: R.Arma) => a.nome || 'Arma sem nome';
const rotuloAtaque = (a: R.Arma) => `Ataque com ${nomeDaArma(a)}`;
const rotuloDano = (a: R.Arma) => `Dano de ${nomeDaArma(a)}`;

/* Toda rolagem pronta da ficha, pela chave que o navegador manda. `livre` marca o dano, que é texto digitado e pode não ser válido.
   `dano` vem no ataque com arma: as duas rolagens saem juntas, acerto e dano. */
export function lerRolagem(d: R.DadosFicha, acao: string): { rotulo: string; nome: string; expressao: string; livre: boolean; dano?: string } | null {
  const [tipo, id] = [acao.slice(0, acao.indexOf('.')), acao.slice(acao.indexOf('.') + 1)];
  if (tipo === 'arma' || tipo === 'dano') {
    const arma = d.arsenal.find(a => a.id === id);
    if (!arma) return null;
    if (tipo === 'dano') return arma.dano.trim() ? { rotulo: rotuloDano(arma), nome: nomeDaArma(arma), expressao: arma.dano.trim(), livre: true } : null;
    const { valor, vantagem } = R.ataqueDaArma(d, arma);
    return { rotulo: rotuloAtaque(arma), nome: nomeDaArma(arma), expressao: expressaoDaRolagem(valor, vantagem), livre: false, dano: arma.dano.trim() || undefined };
  }
  const item = lerAcao(d, acao);
  return item && { rotulo: item.rotulo, nome: item.rotulo, expressao: expressaoDaRolagem(item.valor, item.vantagem), livre: false };
}

/* Conjurar uma habilidade: o acerto vem da perícia escrita nela, o dano do campo Dano. Sem os dois, não há o que rolar. */
export function lerHabilidade(d: R.DadosFicha, id: string): { rotulo: string; acerto?: string; dano?: string } | null {
  const m = d.magias.find(x => x.id === id);
  if (!m) return null;
  const pericia = R.periciaDaHabilidade(m.pericias);
  const acerto = pericia ? expressaoDaRolagem(R.somaDaRolagem(d, 'pericias', pericia), R.vantagemDaRolagem(d, 'pericias', pericia)) : undefined;
  return { rotulo: m.nome || 'Magia sem nome', acerto, dano: m.dano.trim() || undefined };
}

/* Rolagens de combate: armas (ataque e dano), a categoria Combate das perícias, Destreza (reflexo),
   Determinação e Resistência espiritual (vontade). O efeito de raio do acerto extremo só vale nelas.
   A magia com dano também é de combate, mas é decidida na rota, que sabe se a habilidade tem dano. */
const PERICIAS_DE_COMBATE = new Set([
  ...(R.PERICIAS.find(c => c.categoria === 'Combate')?.itens.map(([k]) => k) ?? []),
  'resistenciaEspiritual',
]);
export function acaoDeCombate(acao: string) {
  const [tipo, chave] = [acao.slice(0, acao.indexOf('.')), acao.slice(acao.indexOf('.') + 1)];
  if (tipo === 'arma' || tipo === 'dano' || tipo === 'armas') return true;
  if (tipo === 'pericias') return PERICIAS_DE_COMBATE.has(chave);
  if (tipo === 'corpo') return chave === 'destreza';
  if (tipo === 'mente') return chave === 'onipotencia';
  return false;
}
/* A marca de combate vai dentro do `detalhe`, como o dano: rolagem antiga não tem e conta como fora de combate. */
export const combateDaRolagem = (detalhe: unknown) =>
  !!detalhe && typeof detalhe === 'object' && (detalhe as { combate?: unknown }).combate === true;

/* O dano guardado dentro do `detalhe` da rolagem. Rolagem antiga ou sem dano devolve null. */
export function danoDaRolagem(detalhe: unknown): DanoDaRolagem | null {
  const dano = (detalhe && typeof detalhe === 'object' ? (detalhe as { dano?: unknown }).dano : null) as Partial<DanoDaRolagem> | null | undefined;
  if (!dano || typeof dano.total !== 'number' || typeof dano.det !== 'string') return null;
  return { expressao: String(dano.expressao ?? ''), total: dano.total, det: dano.det };
}

/* Na mesa, as armas do personagem tomam o lugar das linhas de armas leves, médias e pesadas. */
function acoesDasArmas(d: R.DadosFicha): AcaoRolagem[] {
  return d.arsenal.flatMap(a => {
    const { valor, vantagem } = R.ataqueDaArma(d, a);
    const ataque = { id: `arma.${a.id}`, grupo: 'armas' as const, categoria: NOME_GRUPO.armas, rotulo: rotuloAtaque(a), valor, expressao: expressaoDaRolagem(valor, vantagem) };
    const dano = a.dano.trim();
    return dano ? [ataque, { id: `dano.${a.id}`, grupo: 'armas' as const, categoria: NOME_GRUPO.armas, rotulo: rotuloDano(a), valor: 0, expressao: dano }] : [ataque];
  });
}

export function acoesDeRolagem(d: R.DadosFicha): AcaoRolagem[] {
  const criados = d.elementosCriados.map(e => {
    const valor = R.somaDosPontos(e.valor);
    return { id: R.chaveCriado(e.id), grupo: 'elementos' as const, categoria: NOME_GRUPO.elementos, rotulo: e.nome, valor, expressao: expressaoDaRolagem(valor, R.vantagemDosPontos(e.valor)) };
  });
  /* Elemento que o personagem não tem não vira rolagem na mesa. */
  const itensDe = (g: R.Grupo): readonly (readonly string[])[] => (g === 'elementos' ? R.elementosDaFicha(d) : g === 'armas' ? [] : R.GRUPOS[g]);
  return [...acoesDasArmas(d), ...criados, ...R.NOMES_GRUPOS.flatMap(g => itensDe(g).map(item => {
    const [k, rotulo] = item;
    const valor = R.somaDaRolagem(d, g, k);
    return {
      id: `${g}.${k}`, grupo: g, categoria: g === 'pericias' ? CATEGORIA_PERICIA.get(k) ?? NOME_GRUPO[g] : NOME_GRUPO[g],
      rotulo, valor, expressao: expressaoDaRolagem(valor, R.vantagemDaRolagem(d, g, k)),
    };
  }))];
}

export function recursosDaFicha(d: R.DadosFicha): Recurso[] {
  return [
    { id: 'vida', rotulo: 'Vida', atual: d.vidaAtual, max: R.vidaMax(d) },
    { id: 'mana', rotulo: 'Mana', atual: d.manaAtual, max: R.manaMax(d) },
  ];
}

export function resumoDaFicha(f: { id: string; dados: unknown; fotoV: number; atualizado: number }): ResumoDaFicha {
  const d = R.normalizar(f.dados);
  return {
    id: f.id, nome: d.nome || 'Sem nome', atualizado: f.atualizado, fotoV: f.fotoV,
    recursos: recursosDaFicha(d),
    acoes: acoesDeRolagem(d),
    magias: d.magias.map(m => ({ id: m.id, nome: m.nome, elemento: m.elemento, custo: R.custoMagia(d, m), dano: m.dano })),
    fadiga: d.fadiga,
  };
}
