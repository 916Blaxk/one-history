/* Lê o detalhe que o servidor grava ("2d20, fica o maior (14, 7) + 3") para mostrar a rolagem
   como no C.R.I.S e para saber se ela foi extrema. Não decide nada do jogo: só a aparência. */

export interface DetalheSeparado {
  expr: string; maior: boolean; valores: string[]; guardado: number; resto: string;
}

export function separarDetalhe(det: string): DetalheSeparado | null {
  const m = det.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/);
  if (!m) return null;
  const maior = m[1]!.includes('fica o maior');
  const valores = m[2]!.split(',').map(v => v.trim()).filter(Boolean);
  /* No "fica o maior", só um dado conta: os outros aparecem apagados. */
  const guardado = maior ? valores.reduce((melhor, v, i) => (Number(v) > Number(valores[melhor]) ? i : melhor), 0) : -1;
  return { expr: m[1]!.replace(', fica o maior', ''), maior, valores, guardado, resto: m[3]! };
}

export type Extremo = 'critico' | 'falha';

/* Extremo é quando todo dado que conta caiu no máximo (crítico) ou no 1 (falha).
   Só vale para um grupo de dados: numa expressão com vários grupos, não há um "máximo" claro. */
export function extremoDaRolagem(det: string): Extremo | null {
  const p = separarDetalhe(det);
  if (!p) return null;
  const lados = Number(p.expr.match(/^\d*d(\d+)/)?.[1]);
  if (!lados || lados < 2) return null;
  if (/\d*d\d+/.test(p.resto)) return null;
  const contam = (p.guardado >= 0 ? [p.valores[p.guardado]!] : p.valores).map(Number);
  if (contam.length === 0 || contam.some(n => !Number.isFinite(n))) return null;
  if (contam.every(n => n === lados)) return 'critico';
  if (contam.every(n => n === 1)) return 'falha';
  return null;
}
