'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, buscar, mensagem } from './cliente';
import type { Ficha } from './tipos';

export type Patch = Record<string, any>;

function mesclar(a: Patch | null, b: Patch | null): Patch | null {
  if (!a) return b;
  if (!b) return a;
  const r: Patch = { ...a };
  for (const [k, v] of Object.entries(b)) {
    /* Lista é substituída inteira: mesclar transformaria as magias em um objeto. */
    r[k] = v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' ? { ...r[k], ...v } : v;
  }
  return r;
}

/* De onde a ficha vem e para onde vai. A tela embutida usa as rotas de integração, com a chave em vez do cookie. */
export interface TransporteFicha {
  urlLer: string;
  ler: (url: string) => Promise<{ ficha: Ficha }>;
  salvar: (patch: Patch) => Promise<{ ficha: Ficha }>;
}

/* Mantém uma cópia local editável da ficha. Só envia o que mudou, para o mestre e o dono
   poderem editar campos diferentes ao mesmo tempo, e só aceita dados do servidor quando não há edição pendente. */
export function useFichaEditavel(id: string, transporte?: TransporteFicha) {
  const url = transporte?.urlLer ?? `/api/fichas/${id}`;
  const { data, error } = useSWR<{ ficha: Ficha }>(url, transporte?.ler ?? buscar, { refreshInterval: 3000, shouldRetryOnError: false });
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [status, setStatus] = useState('Salvo');
  const pendente = useRef<Patch | null>(null);
  const voo = useRef<Promise<void> | null>(null);
  const tempo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const srv = data?.ficha;
    if (!srv || pendente.current || voo.current) return;
    /* `atualizado` só cresce: uma resposta antiga que chega depois de um salvamento é ignorada. */
    setFicha(a => (!a || a.id !== srv.id || srv.atualizado > a.atualizado ? srv : a));
  }, [data]);

  const enviar = useCallback(function enviar(): Promise<void> {
    clearTimeout(tempo.current);
    if (voo.current) return voo.current;
    const envio = pendente.current;
    if (!envio) return Promise.resolve();
    pendente.current = null;
    const p = (async () => {
      try {
        const r = transporte ? await transporte.salvar(envio) : await api<{ ficha: Ficha }>('PATCH', url, envio);
        /* Sem edição nova, vale o que o servidor gravou: ele pode ter cortado um valor acima do limite. */
        setFicha(a => a && (pendente.current ? { ...a, atualizado: r.ficha.atualizado, fotoV: r.ficha.fotoV } : r.ficha));
        setStatus('Salvo');
      } catch (e) {
        /* Guarda de volta o que não foi: a próxima edição tenta salvar tudo junto. */
        pendente.current = mesclar(envio, pendente.current);
        setStatus('Não salvo');
        toast.error(mensagem(e));
      } finally {
        voo.current = null;
      }
    })();
    voo.current = p;
    return p;
  }, [url, transporte]);

  const salvarAgora = useCallback(async () => {
    if (voo.current) await voo.current;
    await enviar();
  }, [enviar]);

  /* Atualiza a tela na hora e agenda o envio. */
  const definir = useCallback((nova: Ficha, patch: Patch) => {
    setFicha(nova);
    pendente.current = mesclar(pendente.current, patch);
    setStatus('Salvando…');
    clearTimeout(tempo.current);
    tempo.current = setTimeout(() => {
      salvarAgora().then(() => { if (pendente.current && !tempo.current) salvarAgora(); });
    }, 500);
  }, [salvarAgora]);

  useEffect(() => {
    const aoSair = () => { void enviar(); };
    window.addEventListener('pagehide', aoSair);
    return () => { window.removeEventListener('pagehide', aoSair); void enviar(); };
  }, [enviar]);

  return { ficha, setFicha, status, setStatus, definir, salvarAgora, erro: error };
}
