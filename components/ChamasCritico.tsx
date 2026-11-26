'use client';
import { useEffect, useRef } from 'react';

/* Crítico: a borda inteira da tela pega fogo na cor do ícone de quem rolou. Nada aparece no meio:
   as chamas lambem para dentro e somem antes de cobrir o conteúdo.
   É um canvas com partículas somadas (modo "lighter"): onde várias se cruzam, a cor esquenta até o claro. */

/* O fogo dura o solo de guitarra (public/sons/solo.mp3, uns 3,5 s). */
const DURACAO_FOGO = 2600;
const DURACAO_TOTAL = 3600;

function rgb(cor: string): [number, number, number] {
  const c = cor.trim();
  const hex = c.match(/^#([0-9a-f]{6})$/i)?.[1] ?? c.match(/^#([0-9a-f]{3})$/i)?.[1]?.replace(/./g, x => x + x);
  if (hex) return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const m = c.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [255, 80, 20];
}

/* Um borrão redondo pré-desenhado por cor: desenhar uma imagem pronta é muito mais leve que um degradê por partícula. */
function brasa([r, g, b]: [number, number, number], miolo: number, escurecer = 1) {
  [r, g, b] = [r * escurecer, g * escurecer, b * escurecer].map(Math.round) as [number, number, number];
  const tam = 64;
  const tela = document.createElement('canvas');
  tela.width = tela.height = tam;
  const ctx = tela.getContext('2d')!;
  const grad = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  grad.addColorStop(0, `rgba(${Math.min(255, r + miolo)},${Math.min(255, g + miolo)},${Math.min(255, b + miolo)},1)`);
  grad.addColorStop(.35, `rgba(${r},${g},${b},.55)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, tam, tam);
  return tela;
}

interface Particula { x: number; y: number; vx: number; vy: number; vida: number; max: number; tam: number; fase: number; faisca: boolean }

export default function ChamasCritico({ cor, claro, aoTerminar }: { cor: string; claro: string; aoTerminar: () => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const fim = useRef(aoTerminar);
  useEffect(() => { fim.current = aoTerminar; });

  useEffect(() => {
    const el = tela.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      /* Com "reduzir movimento", fica só o brilho parado nas bordas (o CSS cuida dele), sem partículas. */
      const t = setTimeout(() => fim.current(), 1500);
      return () => clearTimeout(t);
    }
    const escala = Math.min(window.devicePixelRatio || 1, 1.5);
    const ajustar = () => { el.width = innerWidth * escala; el.height = innerHeight * escala; };
    ajustar();
    window.addEventListener('resize', ajustar);

    /* Nasce quente (o claro do ícone), queima na cor principal e se apaga escura: é o que separa fogo de fumaça. */
    const quente = brasa(rgb(claro), 40), media = brasa(rgb(cor), 20), fria = brasa(rgb(cor), 0, .55);
    const particulas: Particula[] = [];
    const inicio = performance.now();
    let anterior = inicio, quadro = 0;

    type Borda = 'baixo' | 'cima' | 'esquerda' | 'direita';
    const nascer = (borda: Borda, faisca = false) => {
      const w = innerWidth, h = innerHeight;
      /* Medida com piso: numa tela de celular, o tamanho proporcional deixava as chamas pequenas demais para ver. */
      const base = Math.max(Math.min(w, h), 520);
      const p: Particula = {
        x: 0, y: 0, vx: 0, vy: 0, vida: 0, faisca, fase: Math.random() * 6.3,
        max: faisca ? 900 + Math.random() * 700 : 520 + Math.random() * 520,
        tam: faisca ? 1.5 + Math.random() * 2.5 : base * (.034 + Math.random() * .05),
      };
      if (borda === 'baixo') {
        p.x = Math.random() * w; p.y = h + p.tam * .3;
        p.vy = -(base * (faisca ? .9 : .42) * (.7 + Math.random() * .6)); p.vx = (Math.random() - .5) * 40;
      } else if (borda === 'cima') {
        /* No alto a chama desce um pouco para dentro da tela e logo é puxada de volta para cima. */
        p.x = Math.random() * w; p.y = -p.tam * .3;
        p.vy = base * (faisca ? .5 : .3) * (.6 + Math.random() * .6); p.vx = (Math.random() - .5) * 40;
      } else {
        p.y = Math.random() * h; p.x = borda === 'esquerda' ? -p.tam * .2 : w + p.tam * .2;
        p.vx = (borda === 'esquerda' ? 1 : -1) * base * (.12 + Math.random() * .1);
        p.vy = -(base * (faisca ? .7 : .32) * (.7 + Math.random() * .5));
      }
      particulas.push(p);
    };

    const passo = (agora: number) => {
      const dt = Math.min(48, agora - anterior) / 1000;
      anterior = agora;
      const decorrido = agora - inicio;
      const w = innerWidth, h = innerHeight;

      if (decorrido < DURACAO_FOGO) {
        /* O fogo explode no começo e vai minguando. A quantidade segue o comprimento de cada borda. */
        const forca = 1 - decorrido / DURACAO_FOGO;
        const taxa = (.3 + forca) * dt * 60 / 136;
        const quantas = (comprimento: number) => Math.floor(comprimento * taxa + Math.random());
        for (let i = quantas(w); i > 0; i--) nascer('baixo');
        for (let i = quantas(w * .6); i > 0; i--) nascer('cima');
        for (let i = quantas(h * .5); i > 0; i--) nascer('esquerda');
        for (let i = quantas(h * .5); i > 0; i--) nascer('direita');
        const bordas: Borda[] = ['baixo', 'cima', 'esquerda', 'direita'];
        if (Math.random() < .9) nascer(bordas[Math.floor(Math.random() * 4)]!, true);
        if (Math.random() < .6) nascer('baixo', true);
      }

      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i]!;
        p.vida += dt * 1000;
        if (p.vida >= p.max) { particulas.splice(i, 1); continue; }
        const idade = p.vida / p.max;
        /* O balanço lateral é o que faz a chama dançar em vez de subir reta. */
        p.x += (p.vx + Math.sin(p.fase + p.vida / 90) * (p.faisca ? 60 : 30)) * dt;
        p.y += p.vy * dt;
        /* As de cima freiam rápido e voltam a subir; as outras só perdem força. */
        p.vy = p.vy > 0 ? p.vy * .93 - 6 : p.vy * (p.faisca ? .995 : .985);
        const tam = p.faisca ? p.tam : p.tam * (1 - idade * .75);
        const img = p.faisca ? quente : idade < .2 ? quente : idade < .55 ? media : fria;
        ctx.globalAlpha = p.faisca ? (1 - idade) * (.6 + Math.random() * .4) : (1 - idade) ** 1.2 * .78;
        /* Esticada na vertical: a partícula vira língua de fogo em vez de bolha. */
        ctx.drawImage(img, p.x - tam, p.y - tam * 1.8, tam * 2, tam * 3.6);
      }
      ctx.globalAlpha = 1;

      if (decorrido < DURACAO_TOTAL && (decorrido < DURACAO_FOGO || particulas.length)) quadro = requestAnimationFrame(passo);
      else fim.current();
    };
    quadro = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(quadro); window.removeEventListener('resize', ajustar); };
  }, [cor, claro]);

  return (
    <div className="chamas-critico" aria-hidden="true" style={{ '--fogo': cor, '--fogo-claro': claro } as React.CSSProperties}>
      <div className="chamas-brilho" />
      <canvas ref={tela} />
    </div>
  );
}
