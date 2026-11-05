/* Regras do sistema ONE HISTORY. Roda no navegador e no servidor. */

export const GRUPOS = {
  elementos: [['fogo', 'Fogo'], ['agua', 'Água'], ['vento', 'Vento'], ['terra', 'Terra'], ['cura', 'Cura']],
  armas: [['espada', 'Espada'], ['arco', 'Arco'], ['rapieira', 'Rapieira'], ['machado', 'Machado'], ['adaga', 'Adaga'], ['escudo', 'Escudo']],
  corpo: [
    ['tracao', 'Tração', 'Força de empuxo: empurrar, puxar.'],
    ['tenacidade', 'Tenacidade', 'Aguentar situações degradantes ao corpo.'],
    ['vitalidade', 'Vitalidade', 'Soma na vida.'],
    ['destreza', 'Destreza', 'Capacidade de se mexer rapidamente.'],
  ],
  mente: [
    ['onisciencia', 'Onisciência', 'Seu nível de conhecimento.'],
    ['onipotencia', 'Onipotência', 'Soma na mana.'],
    ['encanto', 'Encanto', ''],
  ],
} as const satisfies Record<string, readonly (readonly string[])[]>;

export type Grupo = keyof typeof GRUPOS;
export const NOMES_GRUPOS = Object.keys(GRUPOS) as Grupo[];
export const TIERS: Record<number, number> = { 1: 2, 2: 2.3, 3: 2.5 };
export const DADOS = [4, 6, 8, 10, 12, 20, 100];

export interface Estagio { min: number; nome: string; txt: string; perda?: number }
export const ESTAGIOS: Estagio[] = [
  { min: 0, nome: 'Sem fadiga', txt: '' },
  { min: 20, nome: 'Desgaste', txt: 'O desgaste começa com você.' },
  { min: 40, nome: 'Cansaço físico', txt: 'Devido ao desgaste mental intenso, seu corpo tem dificuldades de executar o que sua mente pensa.' },
  { min: 60, nome: 'Alucinações', txt: 'Um desgaste mental terrível: todos na sua frente são borrões, e alguns borrões não são o que parecem.', perda: 10 },
  { min: 80, nome: 'Dano mental severo', txt: 'Talvez você nunca se recupere dessa situação.', perda: 20 },
  { min: 99, nome: 'Algo quebrou', txt: 'Algo simplesmente quebrou dentro de você.', perda: 50 },
  { min: 100, nome: '???', txt: '' },
];

export interface DadosFicha {
  player: string; nome: string; idade: string; raca: string; estilo: string;
  tier: number; inventario: string; notas: string;
  manaPerdida: number; fadiga: number; vidaAtual: number; manaAtual: number;
  elementos: Record<string, number>; armas: Record<string, number>;
  corpo: Record<string, number>; mente: Record<string, number>;
}

type BaseVida = Pick<DadosFicha, 'corpo'>;
type BaseMana = Pick<DadosFicha, 'mente' | 'tier' | 'manaPerdida'>;

export const vidaMax = (f: BaseVida) => 15 + f.corpo.vitalidade * 2;
/* Todo arredondamento do sistema é para baixo. O 1e-9 evita que 10 × 2,3 vire 22,999… e perca um ponto. */
export const manaBase = (f: Omit<BaseMana, 'manaPerdida'>) => Math.floor(30 + f.mente.onipotencia * TIERS[f.tier] + 1e-9);
export const manaMax = (f: BaseMana) => Math.max(0, manaBase(f) - f.manaPerdida);

export function estagio(pct: number): Estagio {
  let e = ESTAGIOS[0];
  for (const s of ESTAGIOS) if (pct >= s.min) e = s;
  return e;
}
export function perdaDeCena(f: BaseMana & Pick<DadosFicha, 'fadiga'>) {
  const e = estagio(f.fadiga);
  return e.perda ? Math.floor(manaMax(f) * e.perda / 100) : 0;
}
/* A perda é permanente: reduz a mana total. A mana atual só cai se passar do novo total. */
export function aplicarFimDeCena(f: DadosFicha) {
  const perda = perdaDeCena(f), totalAntes = manaMax(f), pct = estagio(f.fadiga).perda ?? 0;
  f.manaPerdida += perda;
  f.manaAtual = Math.min(f.manaAtual, manaMax(f));
  return { perda, pct, totalAntes, totalDepois: manaMax(f) };
}
/* Quem está no máximo continua no máximo quando o máximo muda. */
export function acompanharMaximos(f: DadosFicha, vidaAntes: number, manaAntes: number) {
  f.vidaAtual = f.vidaAtual === vidaAntes ? vidaMax(f) : Math.min(f.vidaAtual, vidaMax(f));
  f.manaAtual = f.manaAtual === manaAntes ? manaMax(f) : Math.min(f.manaAtual, manaMax(f));
}

export function inteiro(v: unknown, min: number, max: number) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
const texto = (v: unknown, lim: number) => (typeof v === 'string' ? v.slice(0, lim) : '');

/* Transforma qualquer entrada em uma ficha válida: campos desconhecidos somem e números respeitam as travas. */
export function normalizar(entrada: unknown): DadosFicha {
  const o = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, any>;
  const f: DadosFicha = {
    player: texto(o.player, 80), nome: texto(o.nome, 80), idade: texto(String(o.idade ?? ''), 20),
    raca: texto(o.raca, 60), estilo: texto(o.estilo, 80),
    tier: TIERS[o.tier] ? Number(o.tier) : 1,
    inventario: texto(o.inventario, 8000), notas: texto(o.notas, 12000),
    manaPerdida: inteiro(o.manaPerdida, 0, 99999),
    fadiga: inteiro(o.fadiga, 0, 100),
    vidaAtual: 0, manaAtual: 0,
    elementos: {}, armas: {}, corpo: {}, mente: {},
  };
  for (const g of NOMES_GRUPOS) for (const [k] of GRUPOS[g]) f[g][k] = inteiro(o[g]?.[k], 0, 999);
  f.vidaAtual = inteiro(o.vidaAtual ?? vidaMax(f), 0, vidaMax(f));
  f.manaAtual = inteiro(o.manaAtual ?? manaMax(f), 0, manaMax(f));
  return f;
}
