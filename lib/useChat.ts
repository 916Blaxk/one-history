'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, buscar, mensagem as textoErro } from './cliente';
import type { Mensagem, PaginaChat } from './tipos';

/* O chat de dados: junta o que chega a cada 3 segundos, o que a pessoa acabou de rolar
   e as páginas antigas que ela pediu para carregar. */
export function useChat(url: string) {
  const { data, isLoading, mutate } = useSWR<PaginaChat>(url, buscar, { refreshInterval: 3000, shouldRetryOnError: false });
  const [antigas, setAntigas] = useState<Mensagem[]>([]);
  const [proprias, setProprias] = useState<Mensagem[]>([]);
  const [temMaisAntigas, setTemMaisAntigas] = useState<boolean | null>(null);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [aberto, setAberto] = useState(false);

  /* A ficha entrou ou saiu de uma campanha: é outro chat. */
  useEffect(() => {
    setAntigas([]);
    setProprias([]);
    setTemMaisAntigas(null);
  }, [url]);

  const mensagens = useMemo(() => {
    const porId = new Map<string, Mensagem>();
    for (const m of [...antigas, ...(data?.mensagens ?? []), ...proprias]) porId.set(m.id, m);
    return [...porId.values()].sort((a, b) => a.em - b.em || (a.id < b.id ? -1 : 1));
  }, [antigas, data, proprias]);

  const receber = useCallback((m: Mensagem) => {
    setProprias(l => [...l, m]);
    void mutate();
  }, [mutate]);

  const carregarAnteriores = useCallback(async () => {
    const primeira = mensagens[0];
    if (!primeira) return;
    setCarregandoAntigas(true);
    try {
      const r = await api<PaginaChat>('GET', `${url}?antes=${primeira.em}_${encodeURIComponent(primeira.id)}`);
      setAntigas(l => [...r.mensagens, ...l]);
      setTemMaisAntigas(r.temMais);
    } catch (e) {
      toast.error(textoErro(e));
    } finally {
      setCarregandoAntigas(false);
    }
  }, [mensagens, url]);

  return {
    mensagens, receber, carregarAnteriores, carregandoAntigas, aberto, setAberto,
    carregando: isLoading,
    temMais: temMaisAntigas ?? data?.temMais ?? false,
  };
}

export type ChatDados = ReturnType<typeof useChat>;
