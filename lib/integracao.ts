/* Camada de integração com o Tablebola: resumo da ficha, expressões de dados e origens permitidas.
   Roda no navegador e no servidor. O contrato está em docs/contrato-integracao.md. */
import * as R from './regras';

export const VERSAO_ESQUEMA = 1;

export interface AcaoRolagem { id: string; grupo: R.Grupo; categoria: string; rotulo: string; valor: number; expressao: string }
export interface Recurso { id: 'vida' | 'mana'; rotulo: string; atual: number; max: number }
export interface MagiaResumo { id: string; nome: string; elemento: string; custo: number }
export interface ResumoIntegracao {
  schemaVersion: number; id: string; nome: string; atualizado: number;
  retrato: { versao: number; url: string } | null;
  recursos: Recurso[]; acoes: AcaoRolagem[]; magias: MagiaResumo[];
}

const NOME_GRUPO: Record<R.Grupo, string> = { elementos: 'Atributos', armas: 'Armas', corpo: 'Corpo', mente: 'Mente', pericias: 'Perícias' };
const CATEGORIA_PERICIA = new Map(R.PERICIAS.flatMap(c => c.itens.map(([k]) => [k, c.categoria] as const)));

/* A ficha rola sempre d20 + valor. A sala do Tablebola é quem sorteia: aqui só se monta o texto. */
export function expressaoAtributo(valor: number) {
  if (valor > 0) return `1d20+${valor}`;
  return valor < 0 ? `1d20-${-valor}` : '1d20';
}

export function acoesDeRolagem(d: R.DadosFicha): AcaoRolagem[] {
  return R.NOMES_GRUPOS.flatMap(g => R.GRUPOS[g].map(item => {
    const [k, rotulo] = item;
    return {
      id: `${g}.${k}`, grupo: g, categoria: g === 'pericias' ? CATEGORIA_PERICIA.get(k) ?? NOME_GRUPO[g] : NOME_GRUPO[g],
      rotulo, valor: d[g][k], expressao: expressaoAtributo(d[g][k]),
    };
  }));
}

export function recursosDaFicha(d: R.DadosFicha): Recurso[] {
  return [
    { id: 'vida', rotulo: 'Vida', atual: d.vidaAtual, max: R.vidaMax(d) },
    { id: 'mana', rotulo: 'Mana', atual: d.manaAtual, max: R.manaMax(d) },
  ];
}

export function resumoDaFicha(f: { id: string; dados: unknown; fotoV: number; atualizado: number }): ResumoIntegracao {
  const d = R.normalizar(f.dados);
  return {
    schemaVersion: VERSAO_ESQUEMA, id: f.id, nome: d.nome || 'Sem nome', atualizado: f.atualizado,
    retrato: f.fotoV ? { versao: f.fotoV, url: `/api/integracao/fichas/${f.id}/retrato` } : null,
    recursos: recursosDaFicha(d),
    acoes: acoesDeRolagem(d),
    magias: d.magias.map(m => ({ id: m.id, nome: m.nome, elemento: m.elemento, custo: R.custoMagia(d, m) })),
  };
}

/* Aceita só origens exatas: curinga, caminho ou http fora da própria máquina abririam a ficha para outros sites. */
function origemValida(bruta: string) {
  const txt = bruta.trim();
  if (!txt || txt.includes('*')) return null;
  try {
    const u = new URL(txt);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    return (u.protocol === 'https:' || (u.protocol === 'http:' && local)) && u.origin === txt ? u.origin : null;
  } catch { return null; }
}
export function lerOrigens(bruto: string | undefined) {
  return [...new Set((bruto ?? '').split(',').map(origemValida).filter((o): o is string => !!o))];
}
export const origemPermitida = (origem: string | null | undefined, lista: readonly string[]) => !!origem && lista.includes(origem);
