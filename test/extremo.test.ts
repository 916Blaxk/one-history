import { describe, expect, it } from 'vitest';
import { extremoDaRolagem, separarDetalhe } from '../lib/extremo';

describe('rolagem extrema', () => {
  it('d20 no máximo é crítico, no 1 é falha, no meio não é nada', () => {
    expect(extremoDaRolagem('d20 (20)')).toBe('critico');
    expect(extremoDaRolagem('d20 (20) + 5')).toBe('critico');
    expect(extremoDaRolagem('d20 (1) − 2')).toBe('falha');
    expect(extremoDaRolagem('d20 (19)')).toBeNull();
  });

  it('no "fica o maior", só o dado que conta decide', () => {
    expect(extremoDaRolagem('2d20, fica o maior (7, 20)')).toBe('critico');
    expect(extremoDaRolagem('2d20, fica o maior (1, 1)')).toBe('falha');
    expect(extremoDaRolagem('2d20, fica o maior (1, 15)')).toBeNull();
  });

  it('vários dados somados só são extremos se todos caírem no mesmo extremo', () => {
    expect(extremoDaRolagem('2d6 (6, 6) + 3')).toBe('critico');
    expect(extremoDaRolagem('2d6 (6, 5)')).toBeNull();
    expect(extremoDaRolagem('3d4 (1, 1, 1)')).toBe('falha');
  });

  it('ignora expressões com mais de um grupo e textos que não entende', () => {
    expect(extremoDaRolagem('1d20 (20) + 2d6 (3, 4) + 2')).toBeNull();
    expect(extremoDaRolagem('qualquer coisa')).toBeNull();
    expect(extremoDaRolagem('d1 (1)')).toBeNull();
  });

  it('separa expressão, dados e o resto', () => {
    expect(separarDetalhe('2d20, fica o maior (14, 7) + 3')).toEqual({ expr: '2d20', maior: true, valores: ['14', '7'], guardado: 0, resto: '+ 3' });
  });
});

describe('rolagem de combate', () => {
  it('armas, dano, a categoria Combate, Destreza e vontade são combate; o resto não', async () => {
    const { acaoDeCombate } = await import('../lib/resumoFicha');
    for (const a of ['arma.x', 'dano.x', 'armas.leves', 'pericias.combate', 'pericias.lutaDesarmada', 'pericias.esquiva', 'pericias.aparar', 'pericias.arremesso', 'pericias.resistenciaEspiritual', 'corpo.destreza', 'mente.onipotencia'])
      expect(acaoDeCombate(a), a).toBe(true);
    for (const a of ['pericias.historia', 'pericias.investigacao', 'corpo.tracao', 'mente.encanto', 'elementos.fogo', 'criados.e1'])
      expect(acaoDeCombate(a), a).toBe(false);
  });
});
