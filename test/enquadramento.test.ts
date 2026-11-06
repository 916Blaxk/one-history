import { describe, expect, it } from 'vitest';
import { MOLDURA_FOTO, inicial, molduraDaImagem, mudarZoom, prender, tamanhoNaMoldura, zoomMaximo } from '../lib/enquadramento';
import { retirarFundo } from '../lib/retirarFundo';

describe('enquadramento da imagem', () => {
  const quatro = { l: 320, a: 400 };

  it('a imagem começa inteira e centralizada, em qualquer formato', () => {
    for (const [l, a] of [[2000, 1000], [1000, 3000], [320, 400], [50, 50]] as const) {
      const imagem = { l, a }, e = inicial(imagem, MOLDURA_FOTO), t = tamanhoNaMoldura(e, imagem, MOLDURA_FOTO);
      expect(t.l).toBeLessThanOrEqual(MOLDURA_FOTO.l + 1e-9);
      expect(t.a).toBeLessThanOrEqual(MOLDURA_FOTO.a + 1e-9);
      expect(Math.max(t.l / MOLDURA_FOTO.l, t.a / MOLDURA_FOTO.a)).toBeCloseTo(1);
      expect(e.x).toBeCloseTo((MOLDURA_FOTO.l - t.l) / 2);
      expect(e.y).toBeCloseTo((MOLDURA_FOTO.a - t.a) / 2);
    }
  });

  it('sem moldura fixa, ela tem o formato da imagem, limitada ao maior lado', () => {
    expect(molduraDaImagem({ l: 2000, a: 1000 }, 512)).toEqual({ l: 512, a: 256 });
    expect(molduraDaImagem({ l: 100, a: 300 }, 512)).toEqual({ l: 100, a: 300 });
    const imagem = { l: 2000, a: 1000 }, moldura = molduraDaImagem(imagem, 512);
    expect(inicial(imagem, moldura)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it('menor que a moldura, a imagem fica dentro dela; maior, a cobre', () => {
    expect(prender({ zoom: 1, x: -50, y: 500 }, { l: 2000, a: 1000 }, MOLDURA_FOTO)).toEqual({ zoom: 1, x: 0, y: 240 });
    expect(prender({ zoom: 4, x: 100, y: 100 }, quatro, MOLDURA_FOTO)).toEqual({ zoom: 4, x: 0, y: 0 });
    expect(prender({ zoom: 4, x: -9999, y: -9999 }, quatro, MOLDURA_FOTO)).toEqual({ zoom: 4, x: 320 - 1280, y: 400 - 1600 });
  });

  it('o zoom parte do meio da moldura, e voltar a 1 mostra a imagem inteira', () => {
    const e = mudarZoom(inicial(quatro, MOLDURA_FOTO), 2, quatro, MOLDURA_FOTO);
    expect(e).toEqual({ zoom: 2, x: -160, y: -200 });
    expect(mudarZoom(e, 1, quatro, MOLDURA_FOTO)).toEqual(inicial(quatro, MOLDURA_FOTO));
  });

  it('o zoom máximo sempre passa do que preenche a moldura', () => {
    const imagem = { l: 4000, a: 500 }, t = tamanhoNaMoldura({ zoom: zoomMaximo(imagem, MOLDURA_FOTO) }, imagem, MOLDURA_FOTO);
    expect(t.a).toBeGreaterThan(MOLDURA_FOTO.a);
    expect(t.l).toBeGreaterThan(MOLDURA_FOTO.l);
  });
});

describe('retirar o fundo', () => {
  type Cor = readonly [number, number, number, number];
  const BRANCO: Cor = [255, 255, 255, 255], VERMELHO: Cor = [220, 20, 20, 255], AZUL: Cor = [20, 20, 220, 255];
  /* Cada letra do desenho é um pixel. */
  function desenhar(linhas: string[], cores: Record<string, Cor>) {
    const width = linhas[0]!.length, height = linhas.length;
    const data = new Uint8ClampedArray(width * height * 4);
    linhas.forEach((linha, y) => [...linha].forEach((letra, x) => data.set(cores[letra]!, (y * width + x) * 4)));
    return { data, width, height };
  }
  const alfa = (m: ReturnType<typeof desenhar>, x: number, y: number) => m.data[(y * m.width + x) * 4 + 3];

  it('apaga o fundo ligado à borda e mantém o branco cercado pelo personagem', () => {
    const m = desenhar(['bbbbbbbb', 'bvvvvvvb', 'bvbbbbvb', 'bvvvvvvb', 'bbbbbbbb'], { b: BRANCO, v: VERMELHO });
    expect(retirarFundo(m, 25)).toBeGreaterThan(0);
    expect(alfa(m, 0, 0)).toBe(0);
    expect(alfa(m, 7, 4)).toBe(0);
    expect(alfa(m, 1, 1)).toBe(255);
    expect(alfa(m, 3, 2)).toBe(255);
  });

  it('o personagem encostado na borda não vira fundo', () => {
    const m = desenhar(['vbbbbbbb', 'vbbbbbbb', 'vvvbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb'], { b: BRANCO, v: VERMELHO });
    retirarFundo(m, 25);
    expect(alfa(m, 0, 0)).toBe(255);
    expect(alfa(m, 7, 0)).toBe(0);
  });

  it('aceita fundo de duas cores, como o xadrez de transparência falsa', () => {
    const m = desenhar(['bcbcbcbc', 'cvvvvvvb', 'bvvvvvvc', 'cbcbcbcb'], { b: BRANCO, c: [200, 200, 200, 255], v: AZUL });
    retirarFundo(m, 10);
    expect(alfa(m, 0, 0)).toBe(0);
    expect(alfa(m, 1, 0)).toBe(0);
    expect(alfa(m, 3, 2)).toBe(255);
  });

  it('imagem de uma cor só, força zero ou borda sem cor dominante ficam como estão', () => {
    const lisa = desenhar(['vvv', 'vvv', 'vvv'], { v: VERMELHO });
    expect(retirarFundo(lisa, 25)).toBe(0);
    expect(alfa(lisa, 1, 1)).toBe(255);
    const zero = desenhar(['bbb', 'bvb', 'bbb'], { b: BRANCO, v: VERMELHO });
    expect(retirarFundo(zero, 0)).toBe(0);
    expect(alfa(zero, 0, 0)).toBe(255);
  });

  it('mais força apaga tons mais distantes do fundo', () => {
    const cores = { b: BRANCO, c: [225, 225, 225, 255] as Cor, v: VERMELHO };
    const desenho = ['bbbbbbbb', 'bcccccbb', 'bcvvvcbb', 'bcccccbb', 'bbbbbbbb'];
    const fraca = desenhar(desenho, cores), forte = desenhar(desenho, cores);
    retirarFundo(fraca, 10);
    retirarFundo(forte, 40);
    expect(alfa(fraca, 1, 1)).toBeGreaterThan(0);
    expect(alfa(forte, 1, 1)).toBe(0);
    expect(alfa(forte, 3, 2)).toBe(255);
  });
});
