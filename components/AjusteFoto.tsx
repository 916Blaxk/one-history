'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inicial, molduraDaImagem, mudarZoom, prender, tamanhoNaMoldura, zoomMaximo, type Enquadramento, type Tamanho } from '@/lib/enquadramento';
import { LIMITE_FOTO, LIMITE_ORIGINAL } from '@/lib/regras';
import { retirarFundo } from '@/lib/retirarFundo';

/* A retirada de fundo roda a cada mudança da barra: acima disso, a tela do celular trava. */
const MAIOR_LADO_DO_FUNDO = 1024;
const FORCA_INICIAL = 25;

/* WebP guarda a transparência das sobras da moldura. Sem suporte ou grande demais, vira JPEG, em que as sobras precisam de uma cor. */
export function fotoDaTela(tela: HTMLCanvasElement) {
  const webp = tela.toDataURL('image/webp', .82);
  if (webp.startsWith('data:image/webp') && webp.length <= LIMITE_FOTO) return webp;
  const copia = document.createElement('canvas');
  copia.width = tela.width; copia.height = tela.height;
  const ctx = copia.getContext('2d')!;
  ctx.fillStyle = '#1c2440';
  ctx.fillRect(0, 0, copia.width, copia.height);
  ctx.drawImage(tela, 0, 0);
  return copia.toDataURL('image/jpeg', .82);
}

export function arquivoDaTela(tela: HTMLCanvasElement, nome: string) {
  return new Promise<File>((ok, falha) => {
    tela.toBlob(blob => { if (blob) ok(new File([blob], nome, { type: 'image/png' })); else falha(new Error('Este navegador não conseguiu processar a imagem.')); }, 'image/png');
  });
}

export function arquivoDeDataUrl(url: string, nome: string) {
  const [cabeca, base64] = url.split(',');
  const bytes = Uint8Array.from(atob(base64!), c => c.charCodeAt(0));
  return new File([bytes], nome, { type: cabeca!.slice(5).split(';')[0] });
}

/* O original fica menor que a imagem enviada: só precisa dar para reajustar, e precisa caber no envio. */
function originalDaImagem(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  for (const lado of [1024, 768, 512, 384]) {
    const { l, a } = molduraDaImagem({ l: img.naturalWidth, a: img.naturalHeight }, lado);
    c.width = l; c.height = a;
    c.getContext('2d')!.drawImage(img, 0, 0, l, a);
    for (const qualidade of [.82, .6]) {
      const url = c.toDataURL('image/webp', qualidade);
      if (url.length <= LIMITE_ORIGINAL) return url;
    }
  }
  return null;
}

function imagemSemFundo(img: HTMLImageElement, forca: number) {
  const { l, a } = molduraDaImagem({ l: img.naturalWidth, a: img.naturalHeight }, MAIOR_LADO_DO_FUNDO);
  const c = document.createElement('canvas');
  c.width = l; c.height = a;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, l, a);
  const dados = ctx.getImageData(0, 0, l, a);
  retirarFundo(dados, forca);
  ctx.putImageData(dados, 0, 0);
  return c;
}

const SETAS: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };

/* A mesma janela para foto, sprite e cenário. Com `moldura`, o formato é fixo; sem ela, é o da imagem, limitado a `maiorLado`. */
export type ResultadoAjuste = { inteira: boolean; ajuste: Enquadramento; forca: number; original: string | null };
export default function AjusteFoto({ arquivo, titulo, moldura: molduraFixa, maiorLado = 3072, comRetiradaDeFundo = false, comOriginal = false, salvo, forcaSalva, aoSalvar, aoCancelar, aoFalhar }: {
  arquivo: File; titulo: string; moldura?: Tamanho; maiorLado?: number; comRetiradaDeFundo?: boolean; comOriginal?: boolean;
  /* Ao reajustar: abre como a pessoa deixou da última vez. */
  salvo?: Enquadramento | null; forcaSalva?: number;
  aoSalvar: (tela: HTMLCanvasElement, resultado: ResultadoAjuste) => void; aoCancelar: () => void; aoFalhar: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [e, setE] = useState<Enquadramento | null>(salvo ?? null);
  const [forca, setForca] = useState(forcaSalva ?? FORCA_INICIAL);
  const tela = useRef<HTMLCanvasElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const arraste = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const imagem = useMemo<Tamanho | null>(() => (img ? { l: img.naturalWidth, a: img.naturalHeight } : null), [img]);
  const moldura = useMemo<Tamanho | null>(() => (imagem ? molduraFixa ?? molduraDaImagem(imagem, maiorLado) : null), [imagem, molduraFixa, maiorLado]);
  const fonte = useMemo(() => (img && comRetiradaDeFundo ? imagemSemFundo(img, forca) : img), [img, comRetiradaDeFundo, forca]);

  useEffect(() => {
    const url = URL.createObjectURL(arquivo), nova = new Image();
    nova.onload = () => setImg(nova);
    nova.onerror = aoFalhar;
    nova.src = url;
    return () => URL.revokeObjectURL(url);
    // O arquivo não muda enquanto a janela existe: quem abre cria uma janela para cada escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  const carregada = img !== null;
  useEffect(() => { if (carregada) dialogo.current?.showModal(); }, [carregada]);

  /* Sem ajuste guardado, vale a imagem inteira. */
  const atual = useMemo(() => (imagem && moldura ? (e ? prender(e, imagem, moldura) : inicial(imagem, moldura)) : null), [e, imagem, moldura]);

  /* A moldura é a própria imagem final: o que aparece aqui é exatamente o que será salvo. */
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (!ctx || !fonte || !atual || !imagem || !moldura) return;
    const { l, a } = tamanhoNaMoldura(atual, imagem, moldura);
    ctx.clearRect(0, 0, moldura.l, moldura.a);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fonte, atual.x, atual.y, l, a);
  }, [fonte, atual, imagem, moldura]);

  if (!imagem || !moldura || !atual) return null;

  return (
    /* O teclado fica na janela: as teclas da ficha e da mesa não podem agir por trás dela. */
    <dialog ref={dialogo} className="ajuste-foto" aria-labelledby="ajuste-foto-titulo" onCancel={aoCancelar} onKeyDown={ev => ev.stopPropagation()}>
      <h2 id="ajuste-foto-titulo" className="titulo-grupo">{titulo}</h2>
      <p className="ajuste-foto-dica">A imagem começa inteira. Para mostrar só uma parte, aumente o zoom e arraste.</p>
      <canvas
        ref={tela} className="ajuste-foto-moldura" width={moldura.l} height={moldura.a} tabIndex={0} role="img"
        aria-label="Imagem na moldura. Use as setas do teclado para mover."
        onKeyDown={ev => {
          const seta = SETAS[ev.key];
          if (!seta) return;
          ev.preventDefault();
          setE(prender({ ...atual, x: atual.x + seta[0], y: atual.y + seta[1] }, imagem, moldura));
        }}
        onPointerDown={ev => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          arraste.current = { px: ev.clientX, py: ev.clientY, x: atual.x, y: atual.y };
        }}
        onPointerMove={ev => {
          const a = arraste.current;
          if (!a) return;
          /* A moldura na tela pode ser menor que a imagem: o arraste precisa acompanhar o dedo. */
          const escala = moldura.l / ev.currentTarget.clientWidth;
          setE(prender({ ...atual, x: a.x + (ev.clientX - a.px) * escala, y: a.y + (ev.clientY - a.py) * escala }, imagem, moldura));
        }}
        onPointerUp={() => { arraste.current = null; }}
        onPointerCancel={() => { arraste.current = null; }}
      />
      <label className="ajuste-foto-zoom">
        Zoom
        <input type="range" min={1} max={zoomMaximo(imagem, moldura)} step={0.01} value={atual.zoom} onChange={ev => setE(mudarZoom(atual, Number(ev.target.value), imagem, moldura))} />
      </label>
      {comRetiradaDeFundo && (
        <>
          <label className="ajuste-foto-zoom">
            Retirar fundo
            <input type="range" min={0} max={100} step={1} value={forca} onChange={ev => setForca(Number(ev.target.value))} />
          </label>
          <p className="ajuste-foto-dica">Funciona melhor em fundo liso. Se apagar demais, diminua a barra. Em zero, o fundo fica.</p>
        </>
      )}
      <div className="acoes">
        <button type="button" className="btn btn-forte ajuste-foto-salvar" onClick={() => aoSalvar(tela.current!, { inteira: atual.zoom === 1, ajuste: atual, forca, original: comOriginal && img ? originalDaImagem(img) : null })}>Salvar</button>
        <button type="button" className="btn" onClick={() => setE(null)}>Ver inteira</button>
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>
      </div>
    </dialog>
  );
}
