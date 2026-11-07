/* Resumo leve da ficha usado na mesa: vida, mana, rolagens prontas e magias. Roda no navegador e no servidor. */
import * as R from './regras';

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

export function acoesDeRolagem(d: R.DadosFicha): AcaoRolagem[] {
  const criados = d.elementosCriados.map(e => {
    const valor = R.somaDosPontos(e.valor);
    return { id: R.chaveCriado(e.id), grupo: 'elementos' as const, categoria: NOME_GRUPO.elementos, rotulo: e.nome, valor, expressao: expressaoDaRolagem(valor, R.vantagemDosPontos(e.valor)) };
  });
  /* Elemento que o personagem não tem não vira rolagem na mesa. */
  const itensDe = (g: R.Grupo): readonly (readonly string[])[] => (g === 'elementos' ? R.elementosDaFicha(d) : R.GRUPOS[g]);
  return [...criados, ...R.NOMES_GRUPOS.flatMap(g => itensDe(g).map(item => {
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
