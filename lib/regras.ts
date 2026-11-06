/* Regras do sistema ONE HISTORY. Roda no navegador e no servidor. */

export const PERICIAS: readonly { categoria: string; itens: readonly (readonly [string, string, string])[] }[] = [
  { categoria: 'Combate', itens: [['lutaDesarmada', 'Luta desarmada', 'Atacar e se defender sem armas.'], ['esquiva', 'Esquiva', 'Sair do caminho de um ataque ou perigo.'], ['aparar', 'Aparar', 'Bloquear ou desviar um golpe com arma ou escudo.'], ['arremesso', 'Arremesso', 'Lançar objetos e armas de arremesso com precisão.']] },
  { categoria: 'Físicas e movimentação', itens: [['acrobacia', 'Acrobacia', 'Saltar, rolar e fazer manobras corporais.'], ['escalada', 'Escalada', 'Subir muros, árvores e encostas.'], ['natacao', 'Natação', 'Nadar, mergulhar e resistir a correntezas.'], ['corrida', 'Corrida', 'Correr rápido e manter o ritmo em perseguições.'], ['equilibrio', 'Equilíbrio', 'Manter-se de pé em superfícies estreitas ou instáveis.'], ['furtividade', 'Furtividade', 'Mover-se sem ser visto ou ouvido.'], ['sobrevivencia', 'Sobrevivência', 'Achar abrigo, água e caminho em ambientes hostis.']] },
  { categoria: 'Conhecimento', itens: [['historia', 'História', 'Conhecer eventos, povos e figuras do passado.'], ['geografia', 'Geografia', 'Conhecer regiões, rotas, climas e mapas.'], ['religiao', 'Religião', 'Conhecer crenças, cultos, ritos e símbolos sagrados.'], ['mitologia', 'Mitologia', 'Conhecer lendas, deuses e contos antigos.'], ['investigacao', 'Investigação', 'Procurar pistas e deduzir o que aconteceu.'], ['medicina', 'Medicina', 'Diagnosticar e tratar ferimentos e doenças sem magia.'], ['alquimia', 'Alquimia', 'Identificar e preparar poções, venenos e reagentes.'], ['engenharia', 'Engenharia', 'Projetar, entender e consertar máquinas e mecanismos.'], ['arquitetura', 'Arquitetura', 'Entender construções, estruturas e seus pontos fracos.'], ['matematica', 'Matemática', 'Fazer cálculos e resolver problemas lógicos.'], ['linguistica', 'Linguística', 'Entender idiomas, dialetos e escritas desconhecidas.'], ['estrategiaMilitar', 'Estratégia militar', 'Planejar batalhas e ler táticas inimigas.']] },
  { categoria: 'Sociais', itens: [['intimidacao', 'Intimidação', 'Impor medo por presença ou ameaça.'], ['enganacao', 'Enganação', 'Mentir e convencer alguém do que é falso.'], ['atuacao', 'Atuação', 'Interpretar um papel ou emoção de forma convincente.'], ['etiqueta', 'Etiqueta', 'Seguir costumes e se portar bem em cada meio social.'], ['lideranca', 'Liderança', 'Inspirar e coordenar um grupo.'], ['interrogatorio', 'Interrogatório', 'Extrair informação de quem não quer falar.'], ['seducao', 'Sedução', 'Usar charme e atração para influenciar alguém.'], ['negociacao', 'Negociação', 'Barganhar preços, acordos e tréguas.'], ['disfarce', 'Disfarce', 'Mudar a aparência para se passar por outra pessoa.'], ['domesticacao', 'Domesticação', 'Acalmar, treinar e conduzir animais.']] },
  { categoria: 'Exploração e utilidade', itens: [['rastreamento', 'Rastreamento', 'Seguir pegadas e sinais de passagem.'], ['caca', 'Caça', 'Localizar, emboscar e abater presas.'], ['arrombamento', 'Arrombamento', 'Abrir fechaduras e passar por trancas.'], ['truques', 'Truques', 'Fazer prestidigitação e pequenos golpes de mão.'], ['pilotagem', 'Pilotagem', 'Conduzir veículos e embarcações.']] },
  { categoria: 'Profissões e ofícios', itens: [['profissao', 'Profissão', 'Exercer um ofício escolhido pelo personagem.'], ['musica', 'Música', 'Tocar instrumentos, cantar e compor.'], ['danca', 'Dança', 'Dançar com técnica, em apresentações ou eventos.'], ['escultura', 'Escultura', 'Criar e avaliar obras em pedra, madeira ou argila.'], ['criptografia', 'Criptografia', 'Criar e decifrar códigos e mensagens secretas.'], ['conhecimentoCriaturas', 'Conhecimento de criaturas', 'Identificar criaturas, seus hábitos e fraquezas.'], ['conhecimentoArtefatos', 'Conhecimento de artefatos', 'Reconhecer artefatos, sua origem e sua função.'], ['canalizacaoMagica', 'Canalização mágica', 'Conduzir mana pelo corpo ou por um objeto com estabilidade.'], ['controleMana', 'Controle de mana', 'Dosar a mana e evitar desperdício ou descontrole.'], ['ritualistica', 'Ritualística', 'Conduzir rituais e entender seus círculos e etapas.'], ['identificacaoMagica', 'Identificação mágica', 'Reconhecer magias, encantamentos e seus efeitos.'], ['resistenciaEspiritual', 'Resistência espiritual', 'Resistir a influências sobre a mente e o espírito.']] },
  { categoria: 'Perícias adicionais', itens: [['encantar', 'Encantar', 'Imbuir objetos com efeitos mágicos.'], ['tecnologia', 'Tecnologia', 'Entender e operar dispositivos avançados.'], ['extracaoNucleo', 'Extração de núcleo', 'Retirar o núcleo de uma criatura sem danificá-lo.'], ['metalurgica', 'Metalúrgica', 'Trabalhar metais e forjar peças.'], ['sorte', 'Sorte', 'Contar com o acaso quando nenhuma outra perícia se aplica.']] },
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

export interface EstagioNucleo { nome: string; mana: number; gasto: number; sp: number; pv: number; txt?: string }
export const NUCLEOS: EstagioNucleo[] = [
  { nome: 'Vermelho escuro', mana: 0, gasto: 0, sp: 15, pv: 0, txt: 'Seu núcleo acabou de se formar em seu corpo, cheio de impurezas do sangue. Ele fica entre os pulmões e acima do estômago. Você pode sentir as veias de mana passarem por seu corpo, o fortalecendo e tomando uma forma…' },
  { nome: 'Vermelho sólido', mana: 2, gasto: 0, sp: 5, pv: 2 },
  { nome: 'Vermelho claro', mana: 2, gasto: 0, sp: 5, pv: 2 },
  { nome: 'Laranja escuro', mana: 3, gasto: 2, sp: 7, pv: 3 },
  { nome: 'Laranja sólido', mana: 3, gasto: 0, sp: 7, pv: 3 },
  { nome: 'Laranja claro', mana: 3, gasto: 0, sp: 7, pv: 3 },
  { nome: 'Amarelo escuro', mana: 5, gasto: 3, sp: 10, pv: 5 },
  { nome: 'Amarelo sólido', mana: 5, gasto: 0, sp: 10, pv: 5 },
  { nome: 'Amarelo claro', mana: 5, gasto: 0, sp: 10, pv: 5 },
  { nome: 'Prata escuro', mana: 10, gasto: 5, sp: 15, pv: 10 },
  { nome: 'Prata fosco', mana: 10, gasto: 0, sp: 15, pv: 10 },
  { nome: 'Prata brilhante', mana: 10, gasto: 0, sp: 15, pv: 10 },
  { nome: 'Branco', mana: 50, gasto: 10, sp: 40, pv: 40 },
];

export interface AjustesMestre { vida: number; mana: number; sp: number }
export interface Magia { id: string; nome: string; elemento: string; custo: number; dano: string; alcance: string; duracao: string; descricao: string }
export const LIMITE_MAGIAS = 100;
/* Variação de um elemento base ou fusão de dois. A origem é sempre um dos cinco elementos base. */
export interface ElementoCriado { id: string; nome: string; tipo: 'variacao' | 'fusao'; origens: string[]; valor: number }
export const LIMITE_ELEMENTOS_CRIADOS = 20;
export const TAMANHO_NOME_ELEMENTO = 40;
/* Tamanho máximo do texto base64 da foto da ficha. */
export const LIMITE_FOTO = 200_000;

export interface DadosFicha {
  player: string; nome: string; idade: string; raca: string; estilo: string;
  tier: number; inventario: string; notas: string;
  manaPerdida: number; fadiga: number; vidaAtual: number; manaAtual: number; nucleo: number;
  elementos: Record<string, number>; armas: Record<string, number>;
  corpo: Record<string, number>; mente: Record<string, number>; pericias: Record<string, number>;
  /* Só o mestre da campanha altera estes dois. `limites` usa chaves "grupo.item"; sem chave, não há limite. */
  ajustes: AjustesMestre; limites: Record<string, number>;
  magias: Magia[];
  elementosCriados: ElementoCriado[];
  /* Só vale para ficha do mestre na própria campanha: sem isto, os jogadores não sabem que ela existe. */
  publica: boolean;
}

type BaseVida = Pick<DadosFicha, 'corpo' | 'ajustes' | 'nucleo'>;
type BaseMana = Pick<DadosFicha, 'mente' | 'tier' | 'manaPerdida' | 'nucleo' | 'ajustes'>;

/* Cada estágio soma ao que os anteriores já deram. Fichas gravadas antes do núcleo não têm o campo e ficam no primeiro estágio. */
export function bonusNucleo(estagioNucleo: number | undefined) {
  const total = { mana: 0, gasto: 0, sp: 0, pv: 0 };
  for (const n of NUCLEOS.slice(0, (estagioNucleo ?? 0) + 1)) {
    total.mana += n.mana; total.gasto += n.gasto; total.sp += n.sp; total.pv += n.pv;
  }
  return total;
}
export const spGastos = (f: Pick<DadosFicha, 'pericias'>) => Object.values(f.pericias).reduce((soma, v) => soma + v, 0);
export const spTotal = (f: Pick<DadosFicha, 'nucleo' | 'ajustes'>) => Math.max(0, bonusNucleo(f.nucleo).sp + f.ajustes.sp);
export const chaveLimite = (g: Grupo, k: string) => `${g}.${k}`;
export const chaveCriado = (id: string) => `criados.${id}`;
export const fichaPrivada = (f: { donoId: string; dados: Pick<DadosFicha, 'publica'> }, mestreId: string) => f.donoId === mestreId && !f.dados.publica;
/* Lados do dado que a perícia soma à rolagem. O documento do sistema vai até 25; acima disso, o mestre pode liberar o valor, e o dado fica no maior. */
export const dadoAdicional = (valor: number) => (valor <= 0 ? 0 : valor <= 5 ? 2 : valor <= 10 ? 4 : valor <= 15 ? 6 : valor <= 20 ? 8 : 10);
/* O gasto universal do núcleo desconta do custo de toda magia, sem deixar o custo negativo. */
export const custoMagia = (f: Pick<DadosFicha, 'nucleo'>, m: Pick<Magia, 'custo'>) => Math.max(0, m.custo - bonusNucleo(f.nucleo).gasto);

/* O ajuste do mestre fica por cima da fórmula: subir atributo ou núcleo continua valendo. Fichas antigas não têm `ajustes`. */
export const vidaMax = (f: BaseVida) => Math.max(0, 15 + f.corpo.vitalidade * 2 + bonusNucleo(f.nucleo).pv + (f.ajustes?.vida ?? 0));
/* Todo arredondamento do sistema é para baixo. O 1e-9 evita que 10 × 2,3 vire 22,999… e perca um ponto. */
export const manaBase = (f: Omit<BaseMana, 'manaPerdida'>) => Math.floor(30 + f.mente.onipotencia * TIERS[f.tier] + 1e-9) + bonusNucleo(f.nucleo).mana + (f.ajustes?.mana ?? 0);
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

/* Os elementos base por trás de um elemento, atravessando fusões de fusões. */
export function basesDoElemento(chave: string, criados: readonly ElementoCriado[]): string[] {
  const criado = GRUPOS.elementos.some(([k]) => k === chave) ? undefined : criados.find((e) => e.id === chave);
  return criado ? [...new Set(criado.origens.flatMap((o) => basesDoElemento(o, criados)))] : [chave];
}

function normalizarElementosCriados(entrada: unknown): ElementoCriado[] {
  if (!Array.isArray(entrada)) return [];
  const ids = new Set<string>();
  const base = new Set<string>(GRUPOS.elementos.map(([k]) => k));
  /* A origem precisa ter vindo antes na lista: um elemento não pode, nem por voltas, depender de si mesmo. */
  const aceitas = new Set(base);
  const lista: ElementoCriado[] = [];
  for (const bruto of entrada) {
    const e = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
    const nome = texto(e.nome, TAMANHO_NOME_ELEMENTO).trim();
    const tipo = e.tipo === 'fusao' ? 'fusao' : 'variacao';
    const origens = Array.isArray(e.origens) ? e.origens.filter((o): o is string => typeof o === 'string' && aceitas.has(o)) : [];
    const certos = tipo === 'fusao' ? origens.length === 2 && origens[0] !== origens[1] : origens.length === 1;
    /* O id entra na chave de rolagem "criados.id": um arquivo editado não pode trazer ponto nem repetir. */
    const pedido = texto(e.id, 40);
    if (!nome || !certos || !/^[\w-]+$/.test(pedido) || ids.has(pedido) || lista.length >= LIMITE_ELEMENTOS_CRIADOS) continue;
    ids.add(pedido);
    aceitas.add(pedido);
    lista.push({ id: pedido, nome, tipo, origens, valor: inteiro(e.valor ?? 0, 0, 999) });
  }
  return lista;
}

function normalizarMagias(entrada: unknown, criados: readonly ElementoCriado[]): Magia[] {
  if (!Array.isArray(entrada)) return [];
  const ids = new Set<string>();
  return entrada.slice(0, LIMITE_MAGIAS).map((bruta, i) => {
    const m = (bruta && typeof bruta === 'object' ? bruta : {}) as Record<string, unknown>;
    const pedido = texto(m.id, 40);
    /* O id identifica o cartão na tela: um arquivo editado não pode repetir nem omitir. */
    const id = pedido && !ids.has(pedido) ? pedido : `m${i}-${ids.size}`;
    ids.add(id);
    const elemento = GRUPOS.elementos.some(([k]) => k === m.elemento) || criados.some((e) => e.id === m.elemento) ? String(m.elemento) : '';
    return {
      id, nome: texto(m.nome, 80), elemento, custo: inteiro(m.custo ?? 0, 0, 9999), dano: texto(m.dano, 40),
      alcance: texto(m.alcance, 60), duracao: texto(m.duracao, 60), descricao: texto(m.descricao, 4000),
    };
  });
}

/* O que o jogador não pode passar. Só corta o que subiu: valor que o mestre deixou acima do limite fica como está, e pode descer. */
export function aplicarTravasDoJogador(nova: DadosFicha, antes: DadosFicha) {
  for (const g of NOMES_GRUPOS) for (const [k] of GRUPOS[g]) {
    const limite = nova.limites[chaveLimite(g, k)];
    if (limite !== undefined && nova[g][k] > antes[g][k]) nova[g][k] = Math.max(antes[g][k], limite);
  }
  for (const criado of nova.elementosCriados) {
    const limite = nova.limites[chaveCriado(criado.id)];
    const antigo = antes.elementosCriados.find((e) => e.id === criado.id)?.valor ?? 0;
    if (limite !== undefined && criado.valor > antigo) criado.valor = Math.max(antigo, limite);
  }
  let excesso = spGastos(nova) - spTotal(nova);
  for (const [k] of GRUPOS.pericias) {
    if (excesso <= 0) break;
    const corte = Math.min(excesso, Math.max(0, nova.pericias[k] - antes.pericias[k]));
    nova.pericias[k] -= corte;
    excesso -= corte;
  }
}

/* Transforma qualquer entrada em uma ficha válida: campos desconhecidos somem e números respeitam as travas. */
export function normalizar(entrada: unknown): DadosFicha {
  const o = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, any>;
  const elementosCriados = normalizarElementosCriados(o.elementosCriados);
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
    ajustes: {
      vida: inteiro(o.ajustes?.vida ?? 0, -9999, 9999),
      mana: inteiro(o.ajustes?.mana ?? 0, -9999, 9999),
      sp: inteiro(o.ajustes?.sp ?? 0, -9999, 9999),
    },
    limites: {},
    magias: normalizarMagias(o.magias, elementosCriados),
    elementosCriados,
    publica: o.publica === true,
  };
  for (const g of NOMES_GRUPOS) for (const [k] of GRUPOS[g]) {
    f[g][k] = inteiro(o[g]?.[k], 0, 999);
    const limite = o.limites?.[chaveLimite(g, k)];
    if (limite !== undefined && limite !== null && limite !== '') f.limites[chaveLimite(g, k)] = inteiro(limite, 0, 999);
  }
  for (const { id } of elementosCriados) {
    const limite = o.limites?.[chaveCriado(id)];
    if (limite !== undefined && limite !== null && limite !== '') f.limites[chaveCriado(id)] = inteiro(limite, 0, 999);
  }
  f.vidaAtual = inteiro(o.vidaAtual ?? vidaMax(f), 0, vidaMax(f));
  f.manaAtual = inteiro(o.manaAtual ?? manaMax(f), 0, manaMax(f));
  return f;
}
