import { acoesDeRolagem, expressaoDaRolagem, lerAcao } from '../lib/resumoFicha';
import { describe, expect, it } from 'vitest';
import * as R from '../lib/regras';

describe('regras do sistema', () => {
  it('vida usa vitalidade, não tração', () => {
    const f = R.normalizar({ corpo: { vitalidade: 8, tracao: 3 } });
    expect(R.vidaMax(f)).toBe(31);
  });

  it('mana usa o multiplicador do tier e arredonda para baixo', () => {
    expect(R.manaMax(R.normalizar({ mente: { onipotencia: 7 }, tier: 1 }))).toBe(44);
    expect(R.manaMax(R.normalizar({ mente: { onipotencia: 7 }, tier: 2 }))).toBe(46); // 46,1
    expect(R.manaMax(R.normalizar({ mente: { onipotencia: 7 }, tier: 3 }))).toBe(47); // 47,5
    expect(R.manaMax(R.normalizar({ mente: { onipotencia: 10 }, tier: 2 }))).toBe(53); // sem erro de ponto flutuante
  });

  it('estágios de fadiga nos limites do PDF', () => {
    expect([0, 19, 20, 59, 60, 98, 99, 100].map(p => R.estagio(p).min)).toEqual([0, 0, 20, 40, 60, 80, 99, 100]);
  });

  it('fim de cena reduz a mana total de forma permanente e acumulada', () => {
    const f = R.normalizar({ mente: { onipotencia: 7 }, tier: 2, fadiga: 60 });
    expect(f.manaAtual).toBe(46);
    expect(R.aplicarFimDeCena(f).perda).toBe(4);
    expect(R.manaMax(f)).toBe(42);
    expect(f.manaAtual).toBe(42);
    expect(R.aplicarFimDeCena(f).perda).toBe(4); // 10% de 42
    expect(R.manaMax(f)).toBe(38);
  });

  it('fim de cena mantém a mana atual quando ela já está abaixo do novo total', () => {
    const f = R.normalizar({ mente: { onipotencia: 7 }, tier: 2, fadiga: 99, manaAtual: 10 });
    expect(R.aplicarFimDeCena(f).perda).toBe(23);
    expect(R.manaMax(f)).toBe(23);
    expect(f.manaAtual).toBe(10);
  });

  it('não perde mana abaixo de 60% nem em 100%', () => {
    expect(R.perdaDeCena(R.normalizar({ mente: { onipotencia: 7 }, fadiga: 59 }))).toBe(0);
    expect(R.perdaDeCena(R.normalizar({ mente: { onipotencia: 7 }, fadiga: 100 }))).toBe(0);
  });

  it('quem está no máximo acompanha o novo máximo; quem está abaixo fica onde está', () => {
    const cheio = R.normalizar({ corpo: { vitalidade: 5 } });
    const [vA, mA] = [R.vidaMax(cheio), R.manaMax(cheio)];
    cheio.corpo.vitalidade = 8;
    R.acompanharMaximos(cheio, vA, mA);
    expect(cheio.vidaAtual).toBe(31);
    const ferido = R.normalizar({ corpo: { vitalidade: 5 }, vidaAtual: 10 });
    ferido.corpo.vitalidade = 8;
    R.acompanharMaximos(ferido, vA, mA);
    expect(ferido.vidaAtual).toBe(10);
  });

  it('núcleo acumula mana, gasto universal e AP dos estágios alcançados, e não dá vida nem PP', () => {
    expect(R.bonusNucleo(0)).toEqual({ mana: 0, gasto: 0, ap: 0 });
    expect(R.bonusNucleo(3)).toEqual({ mana: 7, gasto: 2, ap: 24 });
    expect(R.bonusNucleo(12)).toEqual({ mana: 108, gasto: 20, ap: 189 });
    expect(R.apTotal(R.normalizar({ nucleo: 0 }))).toBe(25);
    expect(R.apTotal(R.normalizar({ nucleo: 3, ajustes: { ap: 1 } }))).toBe(50);
    expect(R.apTotal(R.normalizar({ nucleo: 12 }))).toBe(214);
    expect(R.ppTotal(R.normalizar({ nucleo: 12 }))).toBe(20);
    expect(R.vidaMax(R.normalizar({ corpo: { vitalidade: 5 }, nucleo: 12 }))).toBe(25);
    expect(R.manaMax(R.normalizar({ mente: { onipotencia: 7 }, tier: 1, nucleo: 3 }))).toBe(51);
  });

  it('ficha antiga, sem núcleo nem perícias, continua com a mesma mana', () => {
    expect(R.manaMax({ mente: { onipotencia: 7 }, tier: 1, manaPerdida: 0 } as unknown as R.DadosFicha)).toBe(44);
    const f = R.normalizar({ mente: { onipotencia: 7 }, tier: 1, manaAtual: 44 });
    expect(f.nucleo).toBe(0);
    expect(Object.keys(f.pericias)).toHaveLength(55);
    expect(f.pericias.sorte).toBe(0);
    expect(f.manaAtual).toBe(44);
  });

  it('perícias somam os PP usados e o estágio do núcleo respeita o limite', () => {
    expect(R.ppGastos(R.normalizar({ pericias: { esquiva: 3, medicina: 2, inventada: 50 } }))).toBe(5);
    expect(R.normalizar({ nucleo: 99 }).nucleo).toBe(12);
  });

  it('cada 15 pontos no atributo dão 1 dado de vantagem', () => {
    const faixas: [number, number][] = [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [999, 66]];
    for (const [pontos, vantagem] of faixas) expect(R.vantagemDaRolagem(R.normalizar({ corpo: { destreza: pontos } }), 'corpo', 'destreza')).toBe(vantagem);
    expect(expressaoDaRolagem(7)).toBe('1d20+7');
    expect(expressaoDaRolagem(0)).toBe('1d20');
    expect(expressaoDaRolagem(5, 1)).toBe('2d20kh1+5');
    expect(expressaoDaRolagem(0, 2)).toBe('3d20kh1');
  });

  it('exemplo do sistema: 15 de Destreza e 5 de Esquiva rolam com 1 de vantagem e somam 5', () => {
    const f = R.normalizar({ corpo: { destreza: 15 }, pericias: { esquiva: 5, aparar: 5, sorte: 5 } });
    expect(lerAcao(f, 'pericias.esquiva')).toMatchObject({ valor: 5, vantagem: 1 });
    /* Aparar é de Tração, e o valor do atributo não soma na perícia. */
    expect(lerAcao(f, 'pericias.aparar')).toMatchObject({ valor: 5, vantagem: 0 });
    /* Sorte não tem atributo definido. */
    expect(lerAcao(f, 'pericias.sorte')).toMatchObject({ valor: 5, vantagem: 0 });
  });

  it('rolar o próprio atributo tem a vantagem dele, sem somar o valor', () => {
    const f = R.normalizar({ corpo: { destreza: 15, tracao: 7 } });
    expect(lerAcao(f, 'corpo.destreza')).toMatchObject({ valor: 0, vantagem: 1 });
    expect(lerAcao(f, 'corpo.tracao')).toMatchObject({ valor: 0, vantagem: 0 });
    expect(acoesDeRolagem(f).find(a => a.id === 'corpo.destreza')!.expressao).toBe('2d20kh1');
    expect(acoesDeRolagem(f).find(a => a.id === 'corpo.tracao')!.expressao).toBe('1d20');
  });

  it('armas e elementos têm vantagem a cada 15 e somam 1/3 do valor, para baixo', () => {
    const lava = { id: 'e1', nome: 'Lava', tipo: 'fusao', origens: ['fogo', 'terra'], valor: 31 };
    const f = R.normalizar({ corpo: { destreza: 45 }, elementos: { fogo: 15 }, armas: { leves: 4, medias: 2 }, elementosCriados: [lava] });
    expect(lerAcao(f, 'elementos.fogo')).toMatchObject({ valor: 5, vantagem: 1 });
    expect(lerAcao(f, 'armas.leves')).toMatchObject({ valor: 1, vantagem: 0 });
    expect(lerAcao(f, 'armas.medias')).toMatchObject({ valor: 0, vantagem: 0 });
    expect(lerAcao(f, 'criados.e1')).toMatchObject({ valor: 10, vantagem: 2 });
    expect(acoesDeRolagem(R.normalizar({ ...f, elementosAtivos: ['fogo'] })).find(a => a.id === 'elementos.fogo')!.expressao).toBe('2d20kh1+5');
    expect(acoesDeRolagem(f).find(a => a.id === 'criados.e1')!.expressao).toBe('3d20kh1+10');
  });

  it('toda perícia tem descrição', () => {
    for (const [, , descricao] of R.GRUPOS.pericias) expect(descricao).not.toBe('');
  });

  it('ajuste do mestre fica por cima da fórmula e a perda de cena continua valendo', () => {
    const f = R.normalizar({ corpo: { vitalidade: 5 }, mente: { onipotencia: 7 }, tier: 1, fadiga: 60, ajustes: { vida: 15, mana: 10, sp: 5 } });
    expect(R.vidaMax(f)).toBe(40);
    f.corpo.vitalidade = 6;
    expect(R.vidaMax(f)).toBe(42);
    expect(R.manaMax(f)).toBe(54);
    expect(R.aplicarFimDeCena(f).perda).toBe(5);
    expect(R.manaMax(f)).toBe(49);
    /* Ficha gravada antes da troca de nome: o bônus de SP vira bônus de PP. */
    expect(R.ppTotal(f)).toBe(25);
  });

  it('a ficha começa com 25 AP e 20 PP, e atributos, armas e elementos dividem os AP', () => {
    const vazia = R.normalizar({});
    expect(R.apTotal(vazia)).toBe(25);
    expect(R.ppTotal(vazia)).toBe(20);
    expect(R.apGastos(vazia)).toBe(0);
    const f = R.normalizar({
      corpo: { tracao: 2 }, mente: { encanto: 3 }, armas: { leves: 4 }, elementos: { fogo: 5 }, pericias: { esquiva: 9 },
      elementosCriados: [{ id: 'e1', nome: 'Lava', tipo: 'variacao', origens: ['fogo'], valor: 6 }],
      ajustes: { ap: 10, pp: -30 },
    });
    expect(R.apGastos(f)).toBe(20);
    expect(R.apTotal(f)).toBe(35);
    expect(R.ppTotal(f)).toBe(0);
  });

  it('toda perícia tem limite: o dela ou o geral, e os demais itens só se definido', () => {
    const f = R.normalizar({ limites: { 'pericias.aparar': 8, 'corpo.tracao': 3 }, ajustes: { limitePericia: 2 } });
    expect(R.limiteDoItem(R.normalizar({}), 'pericias', 'esquiva')).toBe(5);
    expect(R.limiteDoItem(f, 'pericias', 'esquiva')).toBe(7);
    expect(R.limiteDoItem(f, 'pericias', 'aparar')).toBe(8);
    expect(R.limiteDoItem(f, 'corpo', 'tracao')).toBe(3);
    expect(R.limiteDoItem(f, 'corpo', 'destreza')).toBeUndefined();
  });

  it('limites só guardam itens que existem, e valor vazio remove o limite', () => {
    const f = R.normalizar({ limites: { 'corpo.tracao': 3, 'corpo.inventado': 1, 'mente.encanto': null, 'armas.arco': '' } });
    expect(f.limites).toEqual({ 'corpo.tracao': 3 });
  });

  it('fusão e variação aceitam elemento criado antes delas', () => {
    const lava = { id: 'e1', nome: 'Lava', tipo: 'fusao', origens: ['fogo', 'terra'], valor: 0 };
    const obsidiana = { id: 'e2', nome: 'Obsidiana', tipo: 'fusao', origens: ['e1', 'agua'], valor: 0 };
    const criados = (lista: unknown[]) => R.normalizar({ elementosCriados: lista }).elementosCriados.map(e => e.nome);
    expect(criados([lava, obsidiana])).toEqual(['Lava', 'Obsidiana']);
    /* Sem origem anterior não há ciclo: nem a si mesmo, nem a quem vem depois. */
    expect(criados([obsidiana, lava])).toEqual(['Lava']);
    expect(criados([{ ...lava, origens: ['e1', 'fogo'] }])).toEqual([]);
    /* Quem dependia de um elemento inválido cai junto. */
    expect(criados([{ ...lava, origens: ['fogo', 'fogo'] }, obsidiana])).toEqual([]);
    expect(criados([lava, { id: 'e3', nome: 'Magma', tipo: 'variacao', origens: ['e1'] }])).toEqual(['Lava', 'Magma']);
    expect(criados([{ id: 'e3', nome: 'Magma', tipo: 'variacao', origens: ['e1'] }, lava])).toEqual(['Lava']);
    const lista = R.normalizar({ elementosCriados: [lava, obsidiana, { id: 'e3', nome: 'Magma', tipo: 'variacao', origens: ['e2'] }] }).elementosCriados;
    expect(R.basesDoElemento('e3', lista)).toEqual(['fogo', 'terra', 'agua']);
    expect(R.basesDoElemento('e2', lista)).toEqual(['fogo', 'terra', 'agua']);
    expect(R.basesDoElemento('fogo', lista)).toEqual(['fogo']);
  });

  it('a ficha mostra só os elementos adicionados ou que já têm valor', () => {
    const nomes = (o: object) => R.elementosDaFicha(R.normalizar(o)).map(([k]) => k);
    expect(nomes({})).toEqual([]);
    expect(nomes({ elementosAtivos: ['agua', 'inventado', 'agua'] })).toEqual(['agua']);
    /* Ficha antiga, sem a lista: quem tem valor continua à vista. */
    expect(nomes({ elementos: { fogo: 3 } })).toEqual(['fogo']);
  });

  it('as perícias adicionais foram distribuídas, sem perder nenhuma', () => {
    const categorias = R.PERICIAS.map(c => c.categoria);
    expect(categorias).toContain('Magia');
    expect(categorias).not.toContain('Perícias adicionais');
    const chaves = R.GRUPOS.pericias.map(([k]) => k);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const k of ['encantar', 'tecnologia', 'extracaoNucleo', 'metalurgica', 'sorte']) expect(chaves).toContain(k);
    expect(chaves).toHaveLength(55);
  });

  it('cada perícia tem o atributo da lista do sistema, menos Sorte', () => {
    const semAtributo = R.GRUPOS.pericias.map(([k]) => k).filter(k => !R.ATRIBUTO_DA_PERICIA[k]);
    expect(semAtributo).toEqual(['sorte']);
    expect(R.ATRIBUTO_DA_PERICIA.aparar).toBe('tracao');
    expect(R.ATRIBUTO_DA_PERICIA.religiao).toBe('onipotencia');
    expect(R.ATRIBUTO_DA_PERICIA.seducao).toBe('encanto');
  });

  it('outros soma na rolagem, mas os PP vêm do treino', () => {
    const f = R.normalizar({ pericias: { esquiva: 7 }, periciasOutros: { esquiva: 3, inventada: 9, aparar: -4 } });
    expect(f.periciasOutros).toEqual({ esquiva: 3 });
    expect(R.ppGastos(f)).toBe(7);
    expect(lerAcao(f, 'pericias.esquiva')).toMatchObject({ valor: 10, vantagem: 0 });
  });

  it('habilidades são limpas: só nome e descrição, com id único', () => {
    const { habilidades } = R.normalizar({ habilidades: [{ id: 'a', nome: 'Golpe', descricao: 'Forte.', hack: 1 }, { id: 'a', nome: 7 }, 'lixo'] });
    expect(habilidades).toHaveLength(3);
    expect(habilidades[0]).toEqual({ id: 'a', nome: 'Golpe', descricao: 'Forte.' });
    expect(new Set(habilidades.map(h => h.id)).size).toBe(3);
  });

  it('normalizar descarta campos desconhecidos e trava os limites', () => {
    const f = R.normalizar({ hack: 1, fadiga: 500, tier: 9, corpo: { tracao: -3 }, nome: 5 }) as unknown as Record<string, unknown> & { corpo: Record<string, number> };
    expect(f.hack).toBeUndefined();
    expect(f.fadiga).toBe(100);
    expect(f.tier).toBe(1);
    expect(f.corpo.tracao).toBe(0);
    expect(f.nome).toBe('');
  });
});
