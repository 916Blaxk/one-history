/* Regras do sistema ONE HISTORY. Roda no navegador e no servidor. */

export const PERICIAS: readonly { categoria: string; itens: readonly (readonly [string, string, string])[] }[] = [
  { categoria: 'Combate', itens: [['lutaDesarmada', 'Luta desarmada', 'Atacar e se defender sem armas.'], ['esquiva', 'Esquiva', 'Sair do caminho de um ataque ou perigo.'], ['aparar', 'Aparar', 'Bloquear ou desviar um golpe com arma ou escudo.'], ['arremesso', 'Arremesso', 'Lançar objetos e armas de arremesso com precisão.']] },
  { categoria: 'Magia', itens: [['encantar', 'Encantar', 'Imbuir objetos com efeitos mágicos.'], ['canalizacaoMagica', 'Canalização mágica', 'Conduzir mana pelo corpo ou por um objeto com estabilidade.'], ['controleMana', 'Controle de mana', 'Dosar a mana e evitar desperdício ou descontrole.'], ['ritualistica', 'Ritualística', 'Conduzir rituais e entender seus círculos e etapas.'], ['identificacaoMagica', 'Identificação mágica', 'Reconhecer magias, encantamentos e seus efeitos.'], ['extracaoNucleo', 'Extração de núcleo', 'Retirar o núcleo de uma criatura sem danificá-lo.'], ['resistenciaEspiritual', 'Resistência espiritual', 'Resistir a influências sobre a mente e o espírito.']] },
  { categoria: 'Físicas e movimentação', itens: [['acrobacia', 'Acrobacia', 'Saltar, rolar e fazer manobras corporais.'], ['escalada', 'Escalada', 'Subir muros, árvores e encostas.'], ['natacao', 'Natação', 'Nadar, mergulhar e resistir a correntezas.'], ['corrida', 'Corrida', 'Correr rápido e manter o ritmo em perseguições.'], ['equilibrio', 'Equilíbrio', 'Manter-se de pé em superfícies estreitas ou instáveis.'], ['furtividade', 'Furtividade', 'Mover-se sem ser visto ou ouvido.'], ['sobrevivencia', 'Sobrevivência', 'Achar abrigo, água e caminho em ambientes hostis.']] },
  { categoria: 'Conhecimento', itens: [['historia', 'História', 'Conhecer eventos, povos e figuras do passado.'], ['geografia', 'Geografia', 'Conhecer regiões, rotas, climas e mapas.'], ['religiao', 'Religião', 'Conhecer crenças, cultos, ritos e símbolos sagrados.'], ['mitologia', 'Mitologia', 'Conhecer lendas, deuses e contos antigos.'], ['investigacao', 'Investigação', 'Procurar pistas e deduzir o que aconteceu.'], ['medicina', 'Medicina', 'Diagnosticar e tratar ferimentos e doenças sem magia.'], ['alquimia', 'Alquimia', 'Identificar e preparar poções, venenos e reagentes.'], ['engenharia', 'Engenharia', 'Projetar, entender e consertar máquinas e mecanismos.'], ['arquitetura', 'Arquitetura', 'Entender construções, estruturas e seus pontos fracos.'], ['matematica', 'Matemática', 'Fazer cálculos e resolver problemas lógicos.'], ['linguistica', 'Linguística', 'Entender idiomas, dialetos e escritas desconhecidas.'], ['estrategiaMilitar', 'Estratégia militar', 'Planejar batalhas e ler táticas inimigas.'], ['tecnologia', 'Tecnologia', 'Entender e operar dispositivos avançados.']] },
  { categoria: 'Sociais', itens: [['intimidacao', 'Intimidação', 'Impor medo por presença ou ameaça.'], ['enganacao', 'Enganação', 'Mentir e convencer alguém do que é falso.'], ['atuacao', 'Atuação', 'Interpretar um papel ou emoção de forma convincente.'], ['etiqueta', 'Etiqueta', 'Seguir costumes e se portar bem em cada meio social.'], ['lideranca', 'Liderança', 'Inspirar e coordenar um grupo.'], ['interrogatorio', 'Interrogatório', 'Extrair informação de quem não quer falar.'], ['seducao', 'Sedução', 'Usar charme e atração para influenciar alguém.'], ['negociacao', 'Negociação', 'Barganhar preços, acordos e tréguas.'], ['disfarce', 'Disfarce', 'Mudar a aparência para se passar por outra pessoa.'], ['domesticacao', 'Domesticação', 'Acalmar, treinar e conduzir animais.']] },
  { categoria: 'Exploração e utilidade', itens: [['rastreamento', 'Rastreamento', 'Seguir pegadas e sinais de passagem.'], ['caca', 'Caça', 'Localizar, emboscar e abater presas.'], ['arrombamento', 'Arrombamento', 'Abrir fechaduras e passar por trancas.'], ['truques', 'Truques', 'Fazer prestidigitação e pequenos golpes de mão.'], ['pilotagem', 'Pilotagem', 'Conduzir veículos e embarcações.'], ['sorte', 'Sorte', 'Contar com o acaso quando nenhuma outra perícia se aplica.']] },
  { categoria: 'Profissões e ofícios', itens: [['profissao', 'Profissão', 'Exercer um ofício escolhido pelo personagem.'], ['musica', 'Música', 'Tocar instrumentos, cantar e compor.'], ['danca', 'Dança', 'Dançar com técnica, em apresentações ou eventos.'], ['escultura', 'Escultura', 'Criar e avaliar obras em pedra, madeira ou argila.'], ['criptografia', 'Criptografia', 'Criar e decifrar códigos e mensagens secretas.'], ['conhecimentoCriaturas', 'Conhecimento de criaturas', 'Identificar criaturas, seus hábitos e fraquezas.'], ['conhecimentoArtefatos', 'Conhecimento de artefatos', 'Reconhecer artefatos, sua origem e sua função.'], ['metalurgica', 'Metalúrgica', 'Trabalhar metais e forjar peças.']] },
];

export type AtributoPericia = 'destreza' | 'tracao' | 'onisciencia' | 'onipotencia' | 'encanto';
const deAtributo = (atributo: AtributoPericia, chaves: string) => Object.fromEntries(chaves.split(' ').map(k => [k, atributo]));
/* O atributo de cada perícia, da lista do sistema. Ele dá vantagem na rolagem, mas seu valor não soma no resultado. Sorte não está na lista. */
export const ATRIBUTO_DA_PERICIA: Readonly<Record<string, AtributoPericia | undefined>> = {
  ...deAtributo('destreza', 'lutaDesarmada esquiva acrobacia escalada natacao corrida equilibrio furtividade arrombamento truques pilotagem danca'),
  ...deAtributo('tracao', 'aparar arremesso'),
  ...deAtributo('onisciencia', 'sobrevivencia historia geografia mitologia investigacao medicina alquimia engenharia arquitetura matematica linguistica estrategiaMilitar caca profissao criptografia conhecimentoCriaturas conhecimentoArtefatos identificacaoMagica tecnologia extracaoNucleo metalurgica'),
  ...deAtributo('onipotencia', 'religiao rastreamento musica escultura canalizacaoMagica controleMana ritualistica resistenciaEspiritual encantar'),
  ...deAtributo('encanto', 'intimidacao enganacao atuacao etiqueta lideranca interrogatorio seducao negociacao disfarce domesticacao'),
};

export const GRUPOS = {
  pericias: PERICIAS.flatMap(c => c.itens),
  elementos: [['fogo', 'Fogo'], ['agua', 'Água'], ['vento', 'Vento'], ['terra', 'Terra'], ['cura', 'Cura']],
  armas: [['leves', 'Armas leves'], ['medias', 'Armas médias'], ['pesadas', 'Armas pesadas']],
  corpo: [
    ['tracao', 'Tração', 'Força de empuxo: empurrar, puxar.'],
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

/* Vida não vem mais do núcleo: agora vem de pontos de atributo ou de itens. PP também não: o mestre distribui ao longo do RPG. */
export interface EstagioNucleo { nome: string; mana: number; gasto: number; ap: number; txt?: string }
export const NUCLEOS: EstagioNucleo[] = [
  { nome: 'Vermelho escuro', mana: 0, gasto: 0, ap: 0, txt: 'Seu núcleo acabou de se formar em seu corpo, cheio de impurezas do sangue. Ele fica entre os pulmões e acima do estômago. Você pode sentir as veias de mana passarem por seu corpo, o fortalecendo e tomando uma forma…' },
  { nome: 'Vermelho sólido', mana: 2, gasto: 0, ap: 7 },
  { nome: 'Vermelho claro', mana: 2, gasto: 0, ap: 7 },
  { nome: 'Laranja escuro', mana: 3, gasto: 2, ap: 10 },
  { nome: 'Laranja sólido', mana: 3, gasto: 0, ap: 10 },
  { nome: 'Laranja claro', mana: 3, gasto: 0, ap: 10 },
  { nome: 'Amarelo escuro', mana: 5, gasto: 3, ap: 10 },
  { nome: 'Amarelo sólido', mana: 5, gasto: 0, ap: 15 },
  { nome: 'Amarelo claro', mana: 5, gasto: 0, ap: 15 },
  { nome: 'Prata escuro', mana: 10, gasto: 5, ap: 15 },
  { nome: 'Prata fosco', mana: 10, gasto: 0, ap: 20 },
  { nome: 'Prata brilhante', mana: 10, gasto: 0, ap: 20 },
  { nome: 'Branco', mana: 50, gasto: 10, ap: 50 },
];

export const AP_INICIAL = 25;
export const PP_INICIAL = 20;
export const LIMITE_PERICIA_INICIAL = 5;
export interface AjustesMestre { vida: number; mana: number; ap: number; pp: number; limitePericia: number }
export interface Magia { id: string; nome: string; elemento: string; custo: number; dano: string; alcance: string; duracao: string; descricao: string }
export const LIMITE_MAGIAS = 100;
/* Variação de um elemento base ou fusão de dois. A origem é sempre um dos cinco elementos base. */
export interface ElementoCriado { id: string; nome: string; tipo: 'variacao' | 'fusao'; origens: string[]; valor: number }
export const LIMITE_ELEMENTOS_CRIADOS = 20;
export const TAMANHO_NOME_ELEMENTO = 40;
export const LIMITE_HABILIDADES = 100;
export interface Habilidade { id: string; nome: string; descricao: string }
/* Tamanho máximo do texto base64 da foto da ficha. */
export const LIMITE_FOTO = 200_000;
/* A imagem original guardada para reajustar. Somada à foto, precisa caber no limite de um envio. */
export const LIMITE_ORIGINAL = 280_000;

export interface DadosFicha {
  player: string; nome: string; idade: string; raca: string; estilo: string;
  tier: number; inventario: string; notas: string;
  manaPerdida: number; fadiga: number; vidaAtual: number; manaAtual: number; nucleo: number;
  elementos: Record<string, number>; armas: Record<string, number>;
  corpo: Record<string, number>; mente: Record<string, number>; pericias: Record<string, number>;
  /* `limites` usa chaves "grupo.item". Limite só avisa: nenhum número bloqueia a edição. */
  ajustes: AjustesMestre; limites: Record<string, number>;
  magias: Magia[];
  elementosCriados: ElementoCriado[];
  /* Bônus livre de cada perícia. Soma na rolagem, mas não gasta PP, que vem do treino. */
  periciasOutros: Record<string, number>;
  /* Elementos base que o personagem tem. A ficha começa sem nenhum, e o jogador adiciona os dele. */
  elementosAtivos: string[];
  habilidades: Habilidade[];
  /* Só vale para ficha do mestre na própria campanha: sem isto, os jogadores não sabem que ela existe. */
  publica: boolean;
}

type BaseVida = Pick<DadosFicha, 'corpo' | 'ajustes'>;
type BaseMana = Pick<DadosFicha, 'mente' | 'tier' | 'manaPerdida' | 'nucleo' | 'ajustes'>;

/* Cada estágio soma ao que os anteriores já deram. Fichas gravadas antes do núcleo não têm o campo e ficam no primeiro estágio. */
export function bonusNucleo(estagioNucleo: number | undefined) {
  const total = { mana: 0, gasto: 0, ap: 0 };
  for (const n of NUCLEOS.slice(0, (estagioNucleo ?? 0) + 1)) {
    total.mana += n.mana; total.gasto += n.gasto; total.ap += n.ap;
  }
  return total;
}
const somaValores = (r: Record<string, number>) => Object.values(r).reduce((soma, v) => soma + v, 0);
export const ppGastos = (f: Pick<DadosFicha, 'pericias'>) => somaValores(f.pericias);
export const ppTotal = (f: Pick<DadosFicha, 'ajustes'>) => Math.max(0, PP_INICIAL + f.ajustes.pp);
/* Os pontos de atributo também podem ir para armas e elementos, inclusive os criados na ficha. */
export const apGastos = (f: Pick<DadosFicha, 'corpo' | 'mente' | 'armas' | 'elementos' | 'elementosCriados'>) =>
  somaValores(f.corpo) + somaValores(f.mente) + somaValores(f.armas) + somaValores(f.elementos) + f.elementosCriados.reduce((soma, e) => soma + e.valor, 0);
export const apTotal = (f: Pick<DadosFicha, 'nucleo' | 'ajustes'>) => Math.max(0, AP_INICIAL + bonusNucleo(f.nucleo).ap + f.ajustes.ap);
export const chaveLimite = (g: Grupo, k: string) => `${g}.${k}`;
/* Toda perícia tem limite: o definido para ela ou o geral, que o mestre aumenta. Os demais só têm se alguém definir. */
export function limiteDoItem(f: Pick<DadosFicha, 'limites' | 'ajustes'>, g: Grupo, k: string) {
  return f.limites[chaveLimite(g, k)] ?? (g === 'pericias' ? Math.max(0, LIMITE_PERICIA_INICIAL + f.ajustes.limitePericia) : undefined);
}
export const chaveCriado = (id: string) => `criados.${id}`;
export const fichaPrivada = (f: { donoId: string; dados: Pick<DadosFicha, 'publica'> }, mestreId: string) => f.donoId === mestreId && !f.dados.publica;
export const PONTOS_POR_VANTAGEM = 15;
export const vantagemDosPontos = (pontos: number) => Math.floor(pontos / PONTOS_POR_VANTAGEM);
/* Armas e elementos somam 1/3 do valor, para baixo: com 15, são 1 dado de vantagem e +5. */
export const somaDosPontos = (pontos: number) => Math.floor(pontos / 3);
/* Regra do criador do sistema. A perícia usa os pontos do atributo dela, e Sorte não tem atributo. */
export function vantagemDaRolagem(f: Pick<DadosFicha, 'corpo' | 'mente' | 'elementos' | 'armas'>, grupo: Grupo, chave: string) {
  if (grupo !== 'pericias') return vantagemDosPontos(f[grupo][chave] ?? 0);
  const atributo = ATRIBUTO_DA_PERICIA[chave];
  return atributo ? vantagemDosPontos(f.corpo[atributo] ?? f.mente[atributo] ?? 0) : 0;
}
/* Atributo é bruto: dá vantagem, mas o valor dele não soma no resultado, nem na rolagem dele mesmo. */
export function somaDaRolagem(f: Pick<DadosFicha, 'elementos' | 'armas' | 'pericias' | 'periciasOutros'>, grupo: Grupo, chave: string) {
  if (grupo === 'corpo' || grupo === 'mente') return 0;
  if (grupo === 'pericias') return f.pericias[chave]! + (f.periciasOutros[chave] ?? 0);
  return somaDosPontos(f[grupo][chave] ?? 0);
}
/* O gasto universal do núcleo desconta do custo de toda magia, sem deixar o custo negativo. */
export const custoMagia = (f: Pick<DadosFicha, 'nucleo'>, m: Pick<Magia, 'custo'>) => Math.max(0, m.custo - bonusNucleo(f.nucleo).gasto);

/* O ajuste fica por cima da fórmula: subir atributo continua valendo. Fichas antigas não têm `ajustes`. */
export const vidaMax = (f: BaseVida) => Math.max(0, 15 + f.corpo.vitalidade * 2 + (f.ajustes?.vida ?? 0));
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
const objeto = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;

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

/* Elemento com valor continua à vista: fichas de antes desta escolha não têm a lista. */
export const elementosDaFicha = (f: Pick<DadosFicha, 'elementos' | 'elementosAtivos'>) =>
  GRUPOS.elementos.filter(([k]) => f.elementosAtivos.includes(k) || f.elementos[k]! > 0);

function normalizarHabilidades(entrada: unknown): Habilidade[] {
  if (!Array.isArray(entrada)) return [];
  const ids = new Set<string>();
  return entrada.slice(0, LIMITE_HABILIDADES).map((bruta, i) => {
    const h = (bruta && typeof bruta === 'object' ? bruta : {}) as Record<string, unknown>;
    const pedido = texto(h.id, 40);
    const id = pedido && !ids.has(pedido) ? pedido : `h${i}-${ids.size}`;
    ids.add(id);
    return { id, nome: texto(h.nome, 80), descricao: texto(h.descricao, 4000) };
  });
}

/* Transforma qualquer entrada em uma ficha válida: campos desconhecidos somem e números ficam na faixa aceita. */
export function normalizar(entrada: unknown): DadosFicha {
  const o = objeto(entrada);
  const ajustes = objeto(o.ajustes), limites = objeto(o.limites), outrosPericias = objeto(o.periciasOutros);
  const elementosCriados = normalizarElementosCriados(o.elementosCriados);
  const f: DadosFicha = {
    player: texto(o.player, 80), nome: texto(o.nome, 80), idade: texto(String(o.idade ?? ''), 20),
    raca: texto(o.raca, 60), estilo: texto(o.estilo, 80),
    tier: TIERS[Number(o.tier)] ? Number(o.tier) : 1,
    inventario: texto(o.inventario, 8000), notas: texto(o.notas, 12000),
    manaPerdida: inteiro(o.manaPerdida, 0, 99999),
    fadiga: inteiro(o.fadiga, 0, 100),
    nucleo: inteiro(o.nucleo, 0, NUCLEOS.length - 1),
    vidaAtual: 0, manaAtual: 0,
    elementos: {}, armas: {}, corpo: {}, mente: {}, pericias: {},
    ajustes: {
      vida: inteiro(ajustes.vida ?? 0, -9999, 9999),
      mana: inteiro(ajustes.mana ?? 0, -9999, 9999),
      ap: inteiro(ajustes.ap ?? 0, -9999, 9999),
      /* Fichas gravadas antes da troca de nome guardam o bônus em `sp`. */
      pp: inteiro(ajustes.pp ?? ajustes.sp ?? 0, -9999, 9999),
      limitePericia: inteiro(ajustes.limitePericia ?? 0, -9999, 9999),
    },
    limites: {},
    magias: normalizarMagias(o.magias, elementosCriados),
    elementosCriados,
    periciasOutros: {},
    elementosAtivos: Array.isArray(o.elementosAtivos) ? GRUPOS.elementos.map(([k]) => k as string).filter(k => (o.elementosAtivos as unknown[]).includes(k)) : [],
    habilidades: normalizarHabilidades(o.habilidades),
    publica: o.publica === true,
  };
  for (const g of NOMES_GRUPOS) for (const [k] of GRUPOS[g]) {
    f[g][k] = inteiro(objeto(o[g])[k], 0, 999);
    const limite = limites[chaveLimite(g, k)];
    if (limite !== undefined && limite !== null && limite !== '') f.limites[chaveLimite(g, k)] = inteiro(limite, 0, 999);
  }
  for (const [k] of GRUPOS.pericias) {
    const outros = inteiro(outrosPericias[k] ?? 0, 0, 999);
    if (outros) f.periciasOutros[k] = outros;
  }
  for (const { id } of elementosCriados) {
    const limite = limites[chaveCriado(id)];
    if (limite !== undefined && limite !== null && limite !== '') f.limites[chaveCriado(id)] = inteiro(limite, 0, 999);
  }
  f.vidaAtual = inteiro(o.vidaAtual ?? vidaMax(f), 0, vidaMax(f));
  f.manaAtual = inteiro(o.manaAtual ?? manaMax(f), 0, manaMax(f));
  return f;
}
