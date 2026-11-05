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

  it('normalizar descarta campos desconhecidos e trava os limites', () => {
    const f = R.normalizar({ hack: 1, fadiga: 500, tier: 9, corpo: { tracao: -3 }, nome: 5 }) as unknown as Record<string, any>;
    expect(f.hack).toBeUndefined();
    expect(f.fadiga).toBe(100);
    expect(f.tier).toBe(1);
    expect(f.corpo.tracao).toBe(0);
    expect(f.nome).toBe('');
  });
});
