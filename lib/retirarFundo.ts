/* Retira o fundo pela cor, a partir das bordas da imagem. Só apaga o que está ligado à borda: um branco no meio do personagem, cercado por ele, fica. */
type Imagem = { data: Uint8ClampedArray; width: number; height: number };

const OPACO = 16;
/* Uma cor só conta como fundo se aparecer em boa parte da borda: um braço encostado na borda não vira fundo. */
const PARTE_MINIMA_DA_BORDA = 0.15;
const FAIXA_SUAVE = 0.6;

function coresDoFundo({ data, width, height }: Imagem) {
  const grupos = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  const contar = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3]! < OPACO) return;
    total += 1;
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const chave = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const grupo = grupos.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
    grupo.n += 1; grupo.r += r; grupo.g += g; grupo.b += b;
    grupos.set(chave, grupo);
  };
  for (let x = 0; x < width; x++) { contar(x, 0); contar(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { contar(0, y); contar(width - 1, y); }
  return [...grupos.values()]
    .filter((g) => g.n >= total * PARTE_MINIMA_DA_BORDA)
    .map((g) => [g.r / g.n, g.g / g.n, g.b / g.n] as const);
}

/* `forca` é a diferença média de cor aceita em cada canal, de 0 a 255. Devolve a parte da imagem que foi apagada, de 0 a 1. */
export function retirarFundo(imagem: Imagem, forca: number) {
  const { data, width, height } = imagem;
  const total = width * height;
  if (forca <= 0 || total === 0) return 0;
  const cores = coresDoFundo(imagem);

  const distancia = (p: number) => {
    const i = p * 4;
    let menor = Infinity;
    for (const [r, g, b] of cores) {
      menor = Math.min(menor, (Math.abs(data[i]! - r) + Math.abs(data[i + 1]! - g) + Math.abs(data[i + 2]! - b)) / 3);
    }
    return menor;
  };
  const ehFundo = (p: number) => data[p * 4 + 3]! < OPACO || distancia(p) <= forca;

  const fundo = new Uint8Array(total);
  const fila: number[] = [];
  const visitar = (p: number) => {
    if (fundo[p] || !ehFundo(p)) return;
    fundo[p] = 1;
    fila.push(p);
  };
  for (let x = 0; x < width; x++) { visitar(x); visitar((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visitar(y * width); visitar(y * width + width - 1); }
  while (fila.length) {
    const p = fila.pop()!, x = p % width, y = (p - x) / width;
    if (x > 0) visitar(p - 1);
    if (x < width - 1) visitar(p + 1);
    if (y > 0) visitar(p - width);
    if (y < height - 1) visitar(p + width);
  }

  let apagados = 0;
  for (let p = 0; p < total; p++) if (fundo[p]) apagados += 1;
  /* Quase tudo apagado quer dizer imagem de uma cor só, sem personagem: melhor manter do que sumir com ela. */
  if (apagados / total > 0.98) return 0;

  /* A borda do personagem fica suave, para não sobrar um contorno serrilhado da cor do fundo. */
  if (cores.length) {
    const limite = forca * (1 + FAIXA_SUAVE);
    for (let p = 0; p < total; p++) {
      if (fundo[p]) continue;
      const x = p % width, y = (p - x) / width;
      const encosta = (x > 0 && fundo[p - 1]) || (x < width - 1 && fundo[p + 1]) || (y > 0 && fundo[p - width]) || (y < height - 1 && fundo[p + width]);
      if (!encosta) continue;
      const d = distancia(p);
      if (d < limite) data[p * 4 + 3] = Math.round(data[p * 4 + 3]! * (d - forca) / (limite - forca));
    }
  }
  for (let p = 0; p < total; p++) if (fundo[p]) data[p * 4 + 3] = 0;
  return apagados / total;
}
