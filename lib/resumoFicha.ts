/* Resumo leve da ficha usado na mesa: vida, mana, rolagens prontas e magias. Roda no navegador e no servidor. */
import * as R from './regras';

export interface AcaoRolagem { id: string; grupo: R.Grupo; categoria: string; rotulo: string; valor: number; expressao: string }
export interface Recurso { id: 'vida' | 'mana'; rotulo: string; atual: number; max: number }
export interface MagiaResumo { id: string; nome: string; elemento: string; custo: number; dano: string }
export interface ResumoDaFicha {
  id: string; nome: string; atualizado: number; fotoV: number;
  recursos: Recurso[]; acoes: AcaoRolagem[]; magias: MagiaResumo[]; fadiga: number;
}

const NOME_GRUPO: Record<R.Grupo, string> = { elementos: 'Atributos', armas: 'Armas', corpo: 'Corpo', mente: 'Mente', pericias: 'Perícias' };
const CATEGORIA_PERICIA = new Map(R.PERICIAS.flatMap(c => c.itens.map(([k]) => [k, c.categoria] as const)));

/* A rolagem de atributo é sempre d20 + o valor guardado na ficha. */
export function expressaoAtributo(valor: number) {
  if (valor > 0) return `1d20+${valor}`;
  return valor < 0 ? `1d20-${-valor}` : '1d20';
}

/* Só perícia tem dado adicional: atributos, armas, corpo e mente continuam em d20 + valor. */
export function expressaoDaAcao(grupo: R.Grupo, valor: number) {
  const dado = grupo === 'pericias' ? R.dadoAdicional(valor) : 0;
  return dado ? `1d20+1d${dado}+${valor}` : expressaoAtributo(valor);
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
    return criado ? { grupo: 'elementos' as const, rotulo: criado.nome, valor: criado.valor } : null;
  }
  const item = itemDaAcao(acao);
  return item ? { grupo: item.grupo, rotulo: item.rotulo, valor: d[item.grupo][item.chave] } : null;
}

export function acoesDeRolagem(d: R.DadosFicha): AcaoRolagem[] {
  const criados = d.elementosCriados.map(e => ({
    id: R.chaveCriado(e.id), grupo: 'elementos' as const, categoria: NOME_GRUPO.elementos, rotulo: e.nome, valor: e.valor, expressao: expressaoAtributo(e.valor),
  }));
  return [...criados, ...R.NOMES_GRUPOS.flatMap(g => R.GRUPOS[g].map(item => {
    const [k, rotulo] = item;
    return {
      id: `${g}.${k}`, grupo: g, categoria: g === 'pericias' ? CATEGORIA_PERICIA.get(k) ?? NOME_GRUPO[g] : NOME_GRUPO[g],
      rotulo, valor: d[g][k], expressao: expressaoDaAcao(g, d[g][k]),
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
