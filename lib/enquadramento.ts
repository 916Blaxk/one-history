/* A conta da janela de ajuste de imagem. `x` e `y` são o canto da imagem dentro da moldura, e zoom 1 é a imagem inteira, sem corte. */
export type Tamanho = { l: number; a: number };
export interface Enquadramento { zoom: number; x: number; y: number }

export const MOLDURA_FOTO: Tamanho = { l: 320, a: 400 };

/* O enquadramento guardado para reajustar depois vem do navegador: só passa com números de verdade. */
export function normalizarEnquadramento(v: unknown): Enquadramento | null {
  const e = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const { zoom, x, y } = e;
  if (typeof zoom !== 'number' || typeof x !== 'number' || typeof y !== 'number') return null;
  if (![zoom, x, y].every(Number.isFinite) || zoom < 1 || zoom > 1000) return null;
  return { zoom, x, y };
}

/* Sem moldura fixa, ela tem o formato da própria imagem: em zoom 1, não sobra nem falta nada. */
export function molduraDaImagem(imagem: Tamanho, maiorLado: number): Tamanho {
  const escala = Math.min(1, maiorLado / Math.max(imagem.l, imagem.a));
  return { l: Math.max(1, Math.round(imagem.l * escala)), a: Math.max(1, Math.round(imagem.a * escala)) };
}

const escalaInteira = (imagem: Tamanho, moldura: Tamanho) => Math.min(moldura.l / imagem.l, moldura.a / imagem.a);
const entre = (v: number, a: number, b: number) => Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));

export const tamanhoNaMoldura = (e: Pick<Enquadramento, 'zoom'>, imagem: Tamanho, moldura: Tamanho): Tamanho => {
  const escala = escalaInteira(imagem, moldura) * e.zoom;
  return { l: imagem.l * escala, a: imagem.a * escala };
};

/* O zoom máximo depende do formato: uma imagem muito larga precisa de mais zoom só para preencher a moldura. */
export const zoomMaximo = (imagem: Tamanho, moldura: Tamanho) =>
  Math.max(moldura.l / imagem.l, moldura.a / imagem.a) / escalaInteira(imagem, moldura) * 3;

/* A imagem não sai da moldura: maior que ela, cobre sempre; menor, fica dentro dela. */
export function prender(e: Enquadramento, imagem: Tamanho, moldura: Tamanho): Enquadramento {
  const { l, a } = tamanhoNaMoldura(e, imagem, moldura);
  return { zoom: e.zoom, x: entre(e.x, 0, moldura.l - l), y: entre(e.y, 0, moldura.a - a) };
}

export function inicial(imagem: Tamanho, moldura: Tamanho): Enquadramento {
  const { l, a } = tamanhoNaMoldura({ zoom: 1 }, imagem, moldura);
  return { zoom: 1, x: (moldura.l - l) / 2, y: (moldura.a - a) / 2 };
}

/* O zoom parte do meio da moldura: o que a pessoa está olhando continua no lugar. */
export function mudarZoom(e: Enquadramento, zoom: number, imagem: Tamanho, moldura: Tamanho): Enquadramento {
  const fator = zoom / e.zoom, meioL = moldura.l / 2, meioA = moldura.a / 2;
  return prender({ zoom, x: meioL - (meioL - e.x) * fator, y: meioA - (meioA - e.y) * fator }, imagem, moldura);
}
