/* A conta da janela de ajuste da foto. `x` e `y` são o canto da imagem dentro da moldura, e zoom 1 é a imagem inteira, sem corte. */
export const FOTO_LARGURA = 320;
export const FOTO_ALTURA = 400;

export interface Enquadramento { zoom: number; x: number; y: number }

const escalaInteira = (largura: number, altura: number) => Math.min(FOTO_LARGURA / largura, FOTO_ALTURA / altura);
const entre = (v: number, a: number, b: number) => Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));

export const tamanhoNaMoldura = (e: Pick<Enquadramento, 'zoom'>, largura: number, altura: number) => {
  const escala = escalaInteira(largura, altura) * e.zoom;
  return { l: largura * escala, a: altura * escala };
};

/* O zoom máximo depende do formato: uma imagem muito larga precisa de mais zoom só para preencher a moldura. */
export const zoomMaximo = (largura: number, altura: number) =>
  Math.max(FOTO_LARGURA / largura, FOTO_ALTURA / altura) / escalaInteira(largura, altura) * 3;

/* A imagem não sai da moldura: maior que ela, cobre sempre; menor, fica dentro dela. */
export function prender(e: Enquadramento, largura: number, altura: number): Enquadramento {
  const { l, a } = tamanhoNaMoldura(e, largura, altura);
  return { zoom: e.zoom, x: entre(e.x, 0, FOTO_LARGURA - l), y: entre(e.y, 0, FOTO_ALTURA - a) };
}

export function inicial(largura: number, altura: number): Enquadramento {
  const { l, a } = tamanhoNaMoldura({ zoom: 1 }, largura, altura);
  return { zoom: 1, x: (FOTO_LARGURA - l) / 2, y: (FOTO_ALTURA - a) / 2 };
}

/* O zoom parte do meio da moldura: o que a pessoa está olhando continua no lugar. */
export function mudarZoom(e: Enquadramento, zoom: number, largura: number, altura: number): Enquadramento {
  const fator = zoom / e.zoom, meioL = FOTO_LARGURA / 2, meioA = FOTO_ALTURA / 2;
  return prender({ zoom, x: meioL - (meioL - e.x) * fator, y: meioA - (meioA - e.y) * fator }, largura, altura);
}
