'use client';
import { useCallback, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, buscar, mensagem } from './cliente';
import { CHAVE_SOM } from './sons';
import { CHAVE_TEMA, IDS_TEMA } from './temaScript';

/* Preferências só de aparência, guardadas no navegador de cada pessoa: não mudam nada no jogo
   e não precisam de coluna no banco. Quem limpar o navegador volta ao padrão. */

export type Tema = typeof IDS_TEMA[number];
export const TEMAS: { id: Tema; nome: string; desc: string; cores: [string, string] }[] = [
  { id: 'roxo', nome: 'Roxo', desc: 'Arcano', cores: ['#8f6bff', '#d04dff'] },
  { id: 'azul', nome: 'Azul', desc: 'Abismo', cores: ['#3d8bff', '#22d3ee'] },
  { id: 'laranja', nome: 'Laranja', desc: 'Brasa', cores: ['#ff6a1a', '#ffb52e'] },
  { id: 'verde', nome: 'Verde', desc: 'Radioativo', cores: ['#2bff6a', '#c6ff1a'] },
  { id: 'rosa', nome: 'Rosa', desc: 'Neon', cores: ['#ff3d9a', '#ff8ae0'] },
  { id: 'branco', nome: 'Branco', desc: 'Luar', cores: ['#ffffff', '#b9c6ff'] },
  { id: 'vermelho', nome: 'Vermelho', desc: 'Carmesim', cores: ['#ff1f3d', '#ff6a3d'] },
  { id: 'marrom', nome: 'Marrom', desc: 'Terra', cores: ['#c8793a', '#e8b46c'] },
  { id: 'amarelo', nome: 'Amarelo', desc: 'Relâmpago', cores: ['#ffc300', '#fff23a'] },
];
export const TEMA_PADRAO: Tema = 'roxo';


const ouvintes = new Set<() => void>();
function avisar() { for (const o of ouvintes) o(); }
function assinar(o: () => void) {
  ouvintes.add(o);
  /* Outra aba trocou o tema: esta acompanha. */
  const aoArmazenar = (e: StorageEvent) => {
    if (e.key === CHAVE_TEMA) aplicarTema(ler(CHAVE_TEMA, TEMAS.map(t => t.id), TEMA_PADRAO));
    if (e.key === CHAVE_TEMA || e.key === CHAVE_SOM) o();
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

/* Os sons das rolagens são preferência deste navegador: quem joga em silêncio desliga uma vez e pronto. */
export function useSomRolagens(): [boolean, (ligado: boolean) => void] {
  const som = useSyncExternalStore(assinar, () => ler(CHAVE_SOM, ['sim', 'nao'], 'sim'), () => 'sim') === 'sim';
  return [som, (ligado: boolean) => { gravar(CHAVE_SOM, ligado ? 'sim' : 'nao'); avisar(); }];
}

/* O ícone dos dados fica na conta, no servidor: é ele que garante que ninguém pegue o ícone de outra pessoa.
   `meu` vazio é o d20 do tema, que todos podem usar. */
export interface EstilosDado { meu: string | null; ocupados: string[] }
export function useEstiloDado() {
  const { data, mutate } = useSWR<EstilosDado>('/api/conta/estilos-dado', buscar, { shouldRetryOnError: false });
  const escolher = useCallback(async (estilo: string | null) => {
    const antes = data;
    if (antes) void mutate({ ...antes, meu: estilo }, { revalidate: false });
    try {
      await api('PATCH', '/api/conta/estilo-dado', { estilo });
    } catch (e) {
      /* Alguém pegou o ícone antes: volta ao anterior e busca a lista nova, com ele marcado como ocupado. */
      if (antes) void mutate(antes, { revalidate: false });
      toast.error(mensagem(e));
    }
    void mutate();
  }, [data, mutate]);
  return { meu: data?.meu ?? null, ocupados: data?.ocupados ?? [], carregado: !!data, escolher, atualizar: mutate };
}
