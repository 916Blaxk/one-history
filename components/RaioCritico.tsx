'use client';
import { useEffect, useRef } from 'react';

/* Acerto extremo de combate com o ícone de raio: raios vermelhos e pretos rasgam a tela de uma vez,
   a tela pisca e some. É uma descarga só, e não um efeito contínuo: o que fica é o raio no dado do cartão.
   O raio preto não aparece sobre o fundo escuro sem ajuda: ele é desenhado grosso, com um halo vermelho em volta. */

const DURACAO = 1500;
/* Os raios caem nestes instantes (ms): o primeiro é o golpe, os outros são o tremular da descarga. */
const DESCARGAS = [0, 90, 210, 380];

type Ponto = [number, number];

/* Deslocamento do ponto médio: cada metade do segmento ganha um desvio lateral menor que o anterior. */
function trajeto(a: Ponto, b: Ponto, desvio: number, nivel = 0): Ponto[] {
  if (nivel > 6) return [a, b];
  const meio: Ponto = [(a[0] + b[0]) / 2 + (Math.random() - .5) * desvio, (a[1] + b[1]) / 2 + (Math.random() - .5) * desvio];
  return [...trajeto(a, meio, desvio / 2, nivel + 1), ...trajeto(meio, b, desvio / 2, nivel + 1).slice(1)];
}

/* `preto`: metade dos raios é negra com halo vermelho, a outra metade é vermelha com miolo claro. */
interface Raio { tronco: Ponto[]; galhos: Ponto[][]; preto: boolean }

function novoRaio(w: number, h: number): Raio {
  /* Nasce numa borda e corta a tela até o lado oposto, passando perto do meio. */
  const deCima = Math.random() < .7;
  const inicio: Ponto = deCima ? [Math.random() * w, -10] : [Math.random() < .5 ? -10 : w + 10, Math.random() * h * .5];
  const fim: Ponto = [w * (.2 + Math.random() * .6), h * (.55 + Math.random() * .5)];
  const tronco = trajeto(inicio, fim, Math.hypot(fim[0] - inicio[0], fim[1] - inicio[1]) * .35);
  const galhos: Ponto[][] = [];
  for (let i = 0; i < 4; i++) {
    const de = tronco[Math.floor(tronco.length * (.2 + Math.random() * .6))]!;
    const ate: Ponto = [de[0] + (Math.random() - .5) * w * .5, de[1] + Math.random() * h * .35];
    galhos.push(trajeto(de, ate, Math.hypot(ate[0] - de[0], ate[1] - de[1]) * .4, 2));
  }
  return { tronco, galhos, preto: Math.random() < .5 };
}

function tracar(ctx: CanvasRenderingContext2D, pts: Ponto[], largura: number, cor: string, halo: string, brilho: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.lineWidth = largura;
  ctx.strokeStyle = cor;
  ctx.shadowColor = halo;
  ctx.shadowBlur = brilho;
  ctx.stroke();
}

function desenharRaio(ctx: CanvasRenderingContext2D, r: Raio) {
  for (const [pts, peso] of [[r.tronco, 1], ...r.galhos.map(g => [g, .45] as const)] as const) {
    if (r.preto) {
      /* O halo vermelho largo vem primeiro: é ele que recorta o raio negro contra o fundo escuro. */
      tracar(ctx, pts, 14 * peso, '#ff0022', '#ff0022', 30);
      tracar(ctx, pts, 8 * peso, '#000', '#000', 0);
      tracar(ctx, pts, 1.4 * peso, '#5a0008', '#000', 0);
    } else {
      tracar(ctx, pts, 9 * peso, '#000', '#ff0022', 22);
      tracar(ctx, pts, 5 * peso, '#e0001b', '#ff2a2a', 18);
      tracar(ctx, pts, 1.6 * peso, '#ffd6d6', '#ff5a5a', 8);
    }
  }
}

export default function RaioCritico({ aoTerminar }: { aoTerminar: () => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const fim = useRef(aoTerminar);
  useEffect(() => { fim.current = aoTerminar; });

  useEffect(() => {
    const el = tela.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      /* Com "reduzir movimento", fica só o clarão parado nas bordas (o CSS cuida dele), sem raios piscando. */
      const t = setTimeout(() => fim.current(), 1200);
      return () => clearTimeout(t);
    }
    const escala = Math.min(window.devicePixelRatio || 1, 1.5);
    el.width = innerWidth * escala;
    el.height = innerHeight * escala;
    const inicio = performance.now();
    let quadro = 0, caidos = 0;
    let raios: Raio[] = [];
    const passo = (agora: number) => {
      const t = agora - inicio;
      while (caidos < DESCARGAS.length && t >= DESCARGAS[caidos]!) {
        /* O golpe tem quatro raios, metade vermelhos e metade pretos; o tremular redesenha dois, para a descarga parecer viva. */
        raios = Array.from({ length: caidos === 0 ? 4 : 2 }, (_, i) => ({ ...novoRaio(innerWidth, innerHeight), preto: i % 2 === 1 }));
        caidos++;
      }
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const ultima = DESCARGAS[DESCARGAS.length - 1]!;
      /* Pisca entre as descargas e apaga devagar depois da última. */
      const alfa = t < ultima + 120 ? (Math.floor(t / 45) % 3 === 2 ? .35 : 1) : Math.max(0, 1 - (t - ultima - 120) / 500);
      if (alfa > 0) {
        ctx.globalAlpha = alfa;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const r of raios) desenharRaio(ctx, r);
        ctx.globalAlpha = 1;
      }
      if (t < DURACAO) quadro = requestAnimationFrame(passo);
      else fim.current();
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, []);

  return (
    <div className="raio-critico" aria-hidden="true">
      <div className="raio-clarao" />
      <canvas ref={tela} />
    </div>
  );
}
