import { describe, expect, it } from 'vitest';
import { acertoCritico, rolarDanoDoAtaque } from '../lib/critico';
import { rollDice } from '../mesa/src/features/chat/dice-parser';

/* Uma fonte de dados que devolve os números em ordem, para o teste saber o que caiu. */
const fila = (...nums: number[]) => () => nums.shift()!;

describe('crítico no acerto', () => {
  it('é crítico quando o d20 que conta cai 20, com ou sem vantagem', () => {
    expect(acertoCritico(rollDice('1d20+4', fila(20)))).toBe(true);
    expect(acertoCritico(rollDice('1d20+4', fila(19)))).toBe(false);
    expect(acertoCritico(rollDice('2d20kh1+4', fila(7, 20)))).toBe(true);
    expect(acertoCritico(rollDice('2d20kh1', fila(7, 12)))).toBe(false);
  });

  it('no crítico, o dano vai ao máximo de cada dado e soma o bônus', () => {
    expect(rolarDanoDoAtaque('2d6+3', true).total).toBe(15);
    expect(rolarDanoDoAtaque('1d8+2d4+1', true).total).toBe(17);
  });

  it('no crítico, o dado explosivo fica no máximo sem explodir', () => {
    const r = rolarDanoDoAtaque('1d6!', true);
    expect(r.total).toBe(6);
    expect(r.groups[0]!.dice[0]!.rolls).toEqual([6]);
  });

  it('sem crítico, o dano é rolado normalmente', () => {
    for (let i = 0; i < 30; i++) {
      const t = rolarDanoDoAtaque('2d6+3', false).total;
      expect(t).toBeGreaterThanOrEqual(5);
      expect(t).toBeLessThanOrEqual(15);
    }
  });
});
