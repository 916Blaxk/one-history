import { describe, expect, it } from 'vitest';
import { FOTO_ALTURA, FOTO_LARGURA, inicial, mudarZoom, prender, tamanhoNaMoldura, zoomMaximo } from '../lib/enquadramento';

describe('enquadramento da foto', () => {
  it('a imagem começa inteira e centralizada, em qualquer formato', () => {
    for (const [l, a] of [[2000, 1000], [1000, 3000], [320, 400], [50, 50]] as const) {
      const e = inicial(l, a), t = tamanhoNaMoldura(e, l, a);
      expect(t.l).toBeLessThanOrEqual(FOTO_LARGURA + 1e-9);
      expect(t.a).toBeLessThanOrEqual(FOTO_ALTURA + 1e-9);
      expect(Math.max(t.l / FOTO_LARGURA, t.a / FOTO_ALTURA)).toBeCloseTo(1);
      expect(e.x).toBeCloseTo((FOTO_LARGURA - t.l) / 2);
      expect(e.y).toBeCloseTo((FOTO_ALTURA - t.a) / 2);
    }
  });

  it('menor que a moldura, a imagem fica dentro dela; maior, a cobre', () => {
    expect(prender({ zoom: 1, x: -50, y: 500 }, 2000, 1000)).toEqual({ zoom: 1, x: 0, y: 240 });
    const grande = prender({ zoom: 4, x: 100, y: 100 }, 320, 400);
    expect(grande).toEqual({ zoom: 4, x: 0, y: 0 });
    expect(prender({ zoom: 4, x: -9999, y: -9999 }, 320, 400)).toEqual({ zoom: 4, x: 320 - 1280, y: 400 - 1600 });
  });

  it('o zoom parte do meio da moldura, e voltar a 1 mostra a imagem inteira', () => {
    const e = mudarZoom(inicial(320, 400), 2, 320, 400);
    expect(e).toEqual({ zoom: 2, x: -160, y: -200 });
    expect(mudarZoom(e, 1, 320, 400)).toEqual(inicial(320, 400));
  });

  it('o zoom máximo sempre passa do que preenche a moldura', () => {
    const l = 4000, a = 500, m = zoomMaximo(l, a), t = tamanhoNaMoldura({ zoom: m }, l, a);
    expect(t.a).toBeGreaterThan(FOTO_ALTURA);
    expect(t.l).toBeGreaterThan(FOTO_LARGURA);
  });
});
