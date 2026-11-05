/* Regras do sistema ONE HISTORY. Roda no navegador e no servidor. */

export const PERICIAS: readonly { categoria: string; itens: readonly (readonly [string, string])[] }[] = [
  { categoria: 'Combate', itens: [['lutaDesarmada', 'Luta desarmada'], ['esquiva', 'Esquiva'], ['aparar', 'Aparar'], ['arremesso', 'Arremesso']] },
  { categoria: 'Físicas e movimentação', itens: [['acrobacia', 'Acrobacia'], ['escalada', 'Escalada'], ['natacao', 'Natação'], ['corrida', 'Corrida'], ['equilibrio', 'Equilíbrio'], ['furtividade', 'Furtividade'], ['sobrevivencia', 'Sobrevivência']] },
  { categoria: 'Conhecimento', itens: [['historia', 'História'], ['geografia', 'Geografia'], ['religiao', 'Religião'], ['mitologia', 'Mitologia'], ['investigacao', 'Investigação'], ['medicina', 'Medicina'], ['alquimia', 'Alquimia'], ['engenharia', 'Engenharia'], ['arquitetura', 'Arquitetura'], ['matematica', 'Matemática'], ['linguistica', 'Linguística'], ['estrategiaMilitar', 'Estratégia militar']] },
  { categoria: 'Sociais', itens: [['intimidacao', 'Intimidação'], ['enganacao', 'Enganação'], ['atuacao', 'Atuação'], ['etiqueta', 'Etiqueta'], ['lideranca', 'Liderança'], ['interrogatorio', 'Interrogatório'], ['seducao', 'Sedução'], ['negociacao', 'Negociação'], ['disfarce', 'Disfarce'], ['domesticacao', 'Domesticação']] },
  { categoria: 'Exploração e utilidade', itens: [['rastreamento', 'Rastreamento'], ['caca', 'Caça'], ['arrombamento', 'Arrombamento'], ['truques', 'Truques'], ['pilotagem', 'Pilotagem']] },
  { categoria: 'Profissões e ofícios', itens: [['profissao', 'Profissão'], ['musica', 'Música'], ['danca', 'Dança'], ['escultura', 'Escultura'], ['criptografia', 'Criptografia'], ['conhecimentoCriaturas', 'Conhecimento de criaturas'], ['conhecimentoArtefatos', 'Conhecimento de artefatos'], ['canalizacaoMagica', 'Canalização mágica'], ['controleMana', 'Controle de mana'], ['ritualistica', 'Ritualística'], ['identificacaoMagica', 'Identificação mágica'], ['resistenciaEspiritual', 'Resistência espiritual']] },
  { categoria: 'Perícias adicionais', itens: [['encantar', 'Encantar'], ['tecnologia', 'Tecnologia'], ['extracaoNucleo', 'Extração de núcleo'], ['metalurgica', 'Metalúrgica']] },
];

export const GRUPOS = {
  pericias: PERICIAS.flatMap(c => c.itens),
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

export interface EstagioNucleo { nome: string; mana: number; gasto: number; sp: number; txt?: string }
export const NUCLEOS: EstagioNucleo[] = [
  { nome: 'Vermelho escuro', mana: 0, gasto: 0, sp: 0, txt: 'Seu núcleo acabou de se formar em seu corpo, cheio de impurezas do sangue. Ele fica entre os pulmões e acima do estômago. Você pode sentir as veias de mana passarem por seu corpo, o fortalecendo e tomando uma forma…' },
  { nome: 'Vermelho sólido', mana: 2, gasto: 0, sp: 5 },
  { nome: 'Vermelho claro', mana: 2, gasto: 0, sp: 5 },
  { nome: 'Laranja escuro', mana: 3, gasto: 2, sp: 7 },
  { nome: 'Laranja sólido', mana: 3, gasto: 0, sp: 7 },
  { nome: 'Laranja claro', mana: 3, gasto: 0, sp: 7 },
  { nome: 'Amarelo escuro', mana: 5, gasto: 3, sp: 10 },
  { nome: 'Amarelo sólido', mana: 5, gasto: 0, sp: 10 },
  { nome: 'Amarelo claro', mana: 5, gasto: 0, sp: 10 },
  { nome: 'Prata escuro', mana: 10, gasto: 5, sp: 15 },
  { nome: 'Prata fosco', mana: 10, gasto: 0, sp: 15 },
  { nome: 'Prata brilhante', mana: 10, gasto: 0, sp: 15 },
  { nome: 'Branco', mana: 50, gasto: 10, sp: 40 },
];

export interface DadosFicha {
  player: string; nome: string; idade: string; raca: string; estilo: string;
  tier: number; inventario: string; notas: string;
  manaPerdida: number; fadiga: number; vidaAtual: number; manaAtual: number; nucleo: number;
  elementos: Record<string, number>; armas: Record<string, number>;
  corpo: Record<string, number>; mente: Record<string, number>; pericias: Record<string, number>;
}

type BaseVida = Pick<DadosFicha, 'corpo'>;
type BaseMana = Pick<DadosFicha, 'mente' | 'tier' | 'manaPerdida' | 'nucleo'>;

/* Cada estágio soma ao que os anteriores já deram. Fichas gravadas antes do núcleo não têm o campo e ficam no primeiro estágio, que não dá nada. */
export function bonusNucleo(estagioNucleo: number | undefined) {
  const total = { mana: 0, gasto: 0, sp: 0 };
  for (const n of NUCLEOS.slice(0, (estagioNucleo ?? 0) + 1)) {
    total.mana += n.mana; total.gasto += n.gasto; total.sp += n.sp;
  }
  return total;
}
export const spGastos = (f: Pick<DadosFicha, 'pericias'>) => Object.values(f.pericias).reduce((soma, v) => soma + v, 0);

export const vidaMax = (f: BaseVida) => 15 + f.corpo.vitalidade * 2;
/* Todo arredondamento do sistema é para baixo. O 1e-9 evita que 10 × 2,3 vire 22,999… e perca um ponto. */
export const manaBase = (f: Omit<BaseMana, 'manaPerdida'>) => Math.floor(30 + f.mente.onipotencia * TIERS[f.tier] + 1e-9) + bonusNucleo(f.nucleo).mana;
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
    nucleo: inteiro(o.nucleo, 0, NUCLEOS.length - 1),
    vidaAtual: 0, manaAtual: 0,
    elementos: {}, armas: {}, corpo: {}, mente: {}, pericias: {},
  };
  for (const g of NOMES_GRUPOS) for (const [k] of GRUPOS[g]) f[g][k] = inteiro(o[g]?.[k], 0, 999);
  f.vidaAtual = inteiro(o.vidaAtual ?? vidaMax(f), 0, vidaMax(f));
  f.manaAtual = inteiro(o.manaAtual ?? manaMax(f), 0, manaMax(f));
  return f;
}
