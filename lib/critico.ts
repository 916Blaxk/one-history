/* Crítico no acerto: o dano que sai junto vai ao máximo. Usado pelo site (rotas.ts) e pela mesa (mesa/server). */
import { rollDice } from '../mesa/src/features/chat/dice-parser';
import type { DiceRollResult } from '../mesa/src/features/chat/dice-types';

/* O d20 que conta caiu 20, com ou sem vantagem. O rolador já marca isso no grupo. */
export const acertoCritico = (acerto: DiceRollResult) => acerto.groups[0]?.critical === true;

/* No crítico, cada dado do dano cai na face mais alta. O "!" sai: um dado explosivo sempre no máximo
   explodiria até o limite do rolador, e o máximo de um dado é a face mais alta dele. */
export function rolarDanoDoAtaque(expressao: string, critico: boolean): DiceRollResult {
  return critico ? rollDice(expressao.replace(/!/g, ''), lados => lados) : rollDice(expressao);
}
