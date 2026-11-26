'use client';
import { useSyncExternalStore } from 'react';
import { CHAVE_TEMA } from './temaScript';

/* Preferências só de aparência, guardadas no navegador de cada pessoa: não mudam nada no jogo
   e não precisam de coluna no banco. Quem limpar o navegador volta ao padrão. */

export type Tema = 'roxo' | 'azul' | 'laranja';
export const TEMAS: { id: Tema; nome: string; desc: string; cores: [string, string] }[] = [
  { id: 'roxo', nome: 'Roxo', desc: 'Arcano', cores: ['#8f6bff', '#d04dff'] },
  { id: 'azul', nome: 'Azul', desc: 'Abismo', cores: ['#3d8bff', '#22d3ee'] },
  { id: 'laranja', nome: 'Laranja', desc: 'Brasa', cores: ['#ff6a1a', '#ffb52e'] },
];
export const TEMA_PADRAO: Tema = 'roxo';

/* Estilos prontos do cartão de rolagem. "tema" segue a cor do site; os outros têm cor própria. */
export type EstiloDado = 'tema' | 'demonio' | 'brasa' | 'gelo' | 'veneno' | 'sombra' | 'ouro' | 'sangue';
export const ESTILOS_DADO: { id: EstiloDado; nome: string }[] = [
  { id: 'tema', nome: 'Do tema' },
  { id: 'demonio', nome: 'Demônio' },
  { id: 'sangue', nome: 'Sangue' },
  { id: 'brasa', nome: 'Brasa' },
  { id: 'ouro', nome: 'Ouro' },
  { id: 'veneno', nome: 'Veneno' },
  { id: 'gelo', nome: 'Gelo' },
  { id: 'sombra', nome: 'Sombra' },
];
export const ESTILO_PADRAO: EstiloDado = 'tema';

const CHAVE_ESTILO = 'oh-estilo-dado';

const ouvintes = new Set<() => void>();
function avisar() { for (const o of ouvintes) o(); }
function assinar(o: () => void) {
  ouvintes.add(o);
  /* Outra aba trocou o tema: esta acompanha. */
  const aoArmazenar = (e: StorageEvent) => {
    if (e.key === CHAVE_TEMA) aplicarTema(ler(CHAVE_TEMA, TEMAS.map(t => t.id), TEMA_PADRAO));
    if (e.key === CHAVE_TEMA || e.key === CHAVE_ESTILO) o();
  };
  window.addEventListener('storage', aoArmazenar);
  return () => { ouvintes.delete(o); window.removeEventListener('storage', aoArmazenar); };
}

function ler<T extends string>(chave: string, validos: T[], padrao: T): T {
  try {
    const v = localStorage.getItem(chave) as T | null;
    return v && validos.includes(v) ? v : padrao;
  } catch { return padrao; }
}
function gravar(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* Navegador sem armazenamento: vale só nesta visita. */ }
}

function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t;
  const cor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor || '#0b0e1a');
}

export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(assinar, () => ler(CHAVE_TEMA, TEMAS.map(t => t.id), TEMA_PADRAO), () => TEMA_PADRAO);
  return [tema, (t: Tema) => {
    /* A troca de cor anima por um instante; fora dela, nada fica com transição de cor pendurada. */
    const raiz = document.documentElement;
    raiz.classList.add('trocando-tema');
    aplicarTema(t);
    gravar(CHAVE_TEMA, t);
    window.setTimeout(() => raiz.classList.remove('trocando-tema'), 450);
    avisar();
  }];
}

export function useEstiloDado(): [EstiloDado, (e: EstiloDado) => void] {
  const estilo = useSyncExternalStore(assinar, () => ler(CHAVE_ESTILO, ESTILOS_DADO.map(e => e.id), ESTILO_PADRAO), () => ESTILO_PADRAO);
  return [estilo, (e: EstiloDado) => { gravar(CHAVE_ESTILO, e); avisar(); }];
}
