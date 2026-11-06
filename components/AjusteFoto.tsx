'use client';
import { useEffect, useRef, useState } from 'react';
import { FOTO_ALTURA, FOTO_LARGURA, inicial, mudarZoom, prender, tamanhoNaMoldura, zoomMaximo, type Enquadramento } from '@/lib/enquadramento';
import { LIMITE_FOTO } from '@/lib/regras';

/* WebP guarda a transparência das sobras da moldura. Sem suporte ou grande demais, vira JPEG, em que as sobras precisam de uma cor. */
function exportar(tela: HTMLCanvasElement) {
  const webp = tela.toDataURL('image/webp', .82);
  if (webp.startsWith('data:image/webp') && webp.length <= LIMITE_FOTO) return webp;
  const copia = document.createElement('canvas');
  copia.width = tela.width; copia.height = tela.height;
  const ctx = copia.getContext('2d')!;
  ctx.fillStyle = '#3a1d2a';
  ctx.fillRect(0, 0, copia.width, copia.height);
  ctx.drawImage(tela, 0, 0);
  return copia.toDataURL('image/jpeg', .82);
}

const SETAS: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };

export default function AjusteFoto({ arquivo, aoSalvar, aoCancelar, aoFalhar }: {
  arquivo: File; aoSalvar: (foto: string) => void; aoCancelar: () => void; aoFalhar: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [e, setE] = useState<Enquadramento | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const arraste = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(arquivo), nova = new Image();
    nova.onload = () => { setImg(nova); setE(inicial(nova.naturalWidth, nova.naturalHeight)); };
    nova.onerror = aoFalhar;
    nova.src = url;
    return () => URL.revokeObjectURL(url);
    // O arquivo não muda enquanto a janela existe: quem abre cria uma janela para cada escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  const carregada = img !== null;
  useEffect(() => { if (carregada) dialogo.current?.showModal(); }, [carregada]);

  /* A moldura é a própria foto final: o que aparece aqui é exatamente o que será salvo. */
  useEffect(() => {
    const ctx = tela.current?.getContext('2d');
    if (!ctx || !img || !e) return;
    const { l, a } = tamanhoNaMoldura(e, img.naturalWidth, img.naturalHeight);
    ctx.clearRect(0, 0, FOTO_LARGURA, FOTO_ALTURA);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, e.x, e.y, l, a);
  }, [img, e]);

  if (!img || !e) return null;
  const largura = img.naturalWidth, altura = img.naturalHeight;

  return (
    <dialog ref={dialogo} className="ajuste-foto" aria-labelledby="ajuste-foto-titulo" onCancel={aoCancelar}>
      <h2 id="ajuste-foto-titulo" className="titulo-grupo">Ajustar a foto</h2>
      <p className="ajuste-foto-dica">A imagem começa inteira. Para mostrar só uma parte, aumente o zoom e arraste.</p>
      <canvas
        ref={tela} className="ajuste-foto-moldura" width={FOTO_LARGURA} height={FOTO_ALTURA} tabIndex={0} role="img"
        aria-label="Foto na moldura. Use as setas do teclado para mover."
        onKeyDown={ev => {
          const seta = SETAS[ev.key];
          if (!seta) return;
          ev.preventDefault();
          setE(prender({ ...e, x: e.x + seta[0], y: e.y + seta[1] }, largura, altura));
        }}
        onPointerDown={ev => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          arraste.current = { px: ev.clientX, py: ev.clientY, x: e.x, y: e.y };
        }}
        onPointerMove={ev => {
          const a = arraste.current;
          if (!a) return;
          /* A moldura na tela pode ser menor que a foto: o arraste precisa acompanhar o dedo. */
          const escala = FOTO_LARGURA / ev.currentTarget.clientWidth;
          setE(prender({ ...e, x: a.x + (ev.clientX - a.px) * escala, y: a.y + (ev.clientY - a.py) * escala }, largura, altura));
        }}
        onPointerUp={() => { arraste.current = null; }}
        onPointerCancel={() => { arraste.current = null; }}
      />
      <label className="ajuste-foto-zoom">
        Zoom
        <input type="range" min={1} max={zoomMaximo(largura, altura)} step={0.01} value={e.zoom} onChange={ev => setE(mudarZoom(e, Number(ev.target.value), largura, altura))} />
      </label>
      <div className="acoes">
        <button type="button" className="btn btn-forte" onClick={() => aoSalvar(exportar(tela.current!))}>Salvar foto</button>
        <button type="button" className="btn" onClick={() => setE(inicial(largura, altura))}>Ver inteira</button>
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>
      </div>
    </dialog>
  );
}
