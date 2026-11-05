import { describe, expect, it } from 'vitest';
import * as R from '../lib/regras';

describe('regras do sistema', () => {
  it('vida usa vitalidade, não tenacidade', () => {
    const f = R.normalizar({ corpo: { vitalidade: 8, tenacidade: 3 } });
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

  it('núcleo acumula mana, gasto universal e SP dos estágios alcançados', () => {
    expect(R.bonusNucleo(0)).toEqual({ mana: 0, gasto: 0, sp: 15 });
    expect(R.bonusNucleo(3)).toEqual({ mana: 7, gasto: 2, sp: 32 });
    expect(R.bonusNucleo(12)).toEqual({ mana: 108, gasto: 20, sp: 161 });
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

  it('perícias somam os SP usados e o estágio do núcleo respeita o limite', () => {
    expect(R.spGastos(R.normalizar({ pericias: { esquiva: 3, medicina: 2, inventada: 50 } }))).toBe(5);
    expect(R.normalizar({ nucleo: 99 }).nucleo).toBe(12);
  });

  it('ajuste do mestre fica por cima da fórmula e a perda de cena continua valendo', () => {
    const f = R.normalizar({ corpo: { vitalidade: 5 }, mente: { onipotencia: 7 }, tier: 1, fadiga: 60, ajustes: { vida: 15, mana: 10, sp: 5 } });
    expect(R.vidaMax(f)).toBe(40);
    f.corpo.vitalidade = 6;
    expect(R.vidaMax(f)).toBe(42);
    expect(R.manaMax(f)).toBe(54);
    expect(R.aplicarFimDeCena(f).perda).toBe(5);
    expect(R.manaMax(f)).toBe(49);
    expect(R.spTotal(f)).toBe(20);
  });

  it('jogador para no limite do mestre e nos SP, mas pode descer de um valor acima deles', () => {
    const antes = R.normalizar({ corpo: { tracao: 1, destreza: 9 }, pericias: { esquiva: 14 }, limites: { 'corpo.tracao': 3, 'corpo.destreza': 2 } });
    const nova = R.normalizar({ ...antes, corpo: { tracao: 8, destreza: 7 }, pericias: { esquiva: 14, medicina: 5 } });
    R.aplicarTravasDoJogador(nova, antes);
    expect(nova.corpo.tracao).toBe(3);
    expect(nova.corpo.destreza).toBe(7);
    expect(nova.pericias.medicina).toBe(1);
    expect(R.spGastos(nova)).toBe(15);
  });

  it('limites só guardam itens que existem, e valor vazio remove o limite', () => {
    const f = R.normalizar({ limites: { 'corpo.tracao': 3, 'corpo.inventado': 1, 'mente.encanto': null, 'armas.arco': '' } });
    expect(f.limites).toEqual({ 'corpo.tracao': 3 });
  });

  it('normalizar descarta campos desconhecidos e trava os limites', () => {
    const f = R.normalizar({ hack: 1, fadiga: 500, tier: 9, corpo: { tracao: -3 }, nome: 5 }) as unknown as Record<string, any>;
    expect(f.hack).toBeUndefined();
    expect(f.fadiga).toBe(100);
    expect(f.tier).toBe(1);
    expect(f.corpo.tracao).toBe(0);
    expect(f.nome).toBe('');
  });
});
