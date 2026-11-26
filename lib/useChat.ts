'use client';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { api, buscar, mensagem as textoErro } from './cliente';
import type { Mensagem, PaginaChat } from './tipos';
import { extremoDaRolagem, type Extremo } from './extremo';

/* O efeito de tela cheia de uma rolagem extrema. Só para a rolagem que a própria pessoa fez:
   a de outro jogador mostra o cartão marcado, sem tomar a tela de quem não rolou. */
export interface EfeitoExtremo { id: number; tipo: Extremo }

/* A rolagem que acabou de ser pedida e ainda não voltou do servidor. O cartão aparece no clique,
   com o número girando: o resultado de verdade continua vindo só do servidor. */
/* `comDano`: ataque e habilidade mostram dois números girando, acerto e dano. */
export interface RolagemPendente { id: number; rotulo: string; lados: number; popup: boolean; comDano: boolean }
let proximaPendente = 1;
/* O número gira pelo menos isto, mesmo com o servidor respondendo antes: abaixo disso o giro vira um piscar. */
const GIRO_MINIMO = 260;

/* O chat de dados: junta o que chega a cada 3 segundos, o que a pessoa acabou de rolar
   e as páginas antigas que ela pediu para carregar. */
export function useChat(url: string) {
  const { data, isLoading, mutate } = useSWR<PaginaChat>(url, buscar, { refreshInterval: 3000, shouldRetryOnError: false });
  const [antigas, setAntigas] = useState<Mensagem[]>([]);
  const [proprias, setProprias] = useState<Mensagem[]>([]);
  const [temMaisAntigas, setTemMaisAntigas] = useState<boolean | null>(null);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState<Mensagem | null>(null);
  const [pendente, setPendente] = useState<RolagemPendente | null>(null);
  const [efeito, setEfeito] = useState<EfeitoExtremo | null>(null);

  /* A ficha entrou ou saiu de uma campanha: é outro chat. */
  const [urlAtual, setUrlAtual] = useState(url);
  if (urlAtual !== url) {
    setUrlAtual(url);
    setAntigas([]);
    setProprias([]);
    setTemMaisAntigas(null);
    setDestaque(null);
    setPendente(null);
  }

  const mensagens = useMemo(() => {
    const porId = new Map<string, Mensagem>();
    for (const m of [...antigas, ...(data?.mensagens ?? []), ...proprias]) porId.set(m.id, m);
    return [...porId.values()].sort((a, b) => a.em - b.em || (a.id < b.id ? -1 : 1));
  }, [antigas, data, proprias]);

  const receber = useCallback((m: Mensagem) => {
    setProprias(l => [...l, m]);
    void mutate();
  }, [mutate]);

  /* Mostra o cartão na hora e troca pelo resultado quando o servidor responde.
     `popup`: com o chat fechado, o resultado fica num pop-up ao lado da aba. */
  const rolar = useCallback(async (info: { rotulo: string; lados?: number; popup?: boolean; comDano?: boolean }, pedir: () => Promise<Mensagem>) => {
    const p: RolagemPendente = { id: proximaPendente++, rotulo: info.rotulo, lados: info.lados ?? 20, popup: !!info.popup, comDano: !!info.comDano };
    const desde = performance.now();
    setPendente(p);
    if (info.popup) setDestaque(null);
    try {
      const m = await pedir();
      const falta = GIRO_MINIMO - (performance.now() - desde);
      if (falta > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(r => setTimeout(r, falta));
      setProprias(l => [...l, m]);
      if (info.popup) setDestaque(m);
      const extremo = extremoDaRolagem(m.det);
      if (extremo) setEfeito({ id: p.id, tipo: extremo });
      void mutate();
    } catch (e) {
      toast.error(textoErro(e));
    } finally {
      setPendente(atual => (atual?.id === p.id ? null : atual));
    }
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
    mensagens, receber, rolar, pendente, efeito, setEfeito, carregarAnteriores, carregandoAntigas, aberto, setAberto, destaque, setDestaque,
    carregando: isLoading,
    temMais: temMaisAntigas ?? data?.temMais ?? false,
  };
}

export type ChatDados = ReturnType<typeof useChat>;
