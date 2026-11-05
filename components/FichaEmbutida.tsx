'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import EditorFicha from '@/components/EditorFicha';
import { ErroApi, mensagem } from '@/lib/cliente';
import { origemPermitida, recursosDaFicha, VERSAO_ESQUEMA } from '@/lib/integracao';
import type { Ficha } from '@/lib/tipos';
import { useFichaEditavel, type Patch, type TransporteFicha } from '@/lib/useFicha';

/* A chave vem no fragmento da URL, que o navegador não envia ao servidor nem em Referer. */
function lerChave() {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.slice(1)).get('chave');
}

async function pedir<T>(chave: string | null, metodo: string, url: string, corpo?: Patch): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { ...(chave ? { Authorization: `Bearer ${chave}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.');
  }
  const dados = await r.json().catch(() => null);
  if (!r.ok) throw new ErroApi(r.status, dados?.erro || 'Algo deu errado. Tente de novo em instantes.');
  return dados as T;
}

export default function FichaEmbutida({ id, origens }: { id: string; origens: string[] }) {
  const [chave] = useState(lerChave);
  const transporte = useMemo<TransporteFicha>(() => ({
    urlLer: `/api/integracao/fichas/${id}`,
    ler: url => pedir<{ ficha: Ficha }>(chave, 'GET', url),
    salvar: patch => pedir<{ ficha: Ficha }>(chave, 'PATCH', `/api/integracao/fichas/${id}/recursos`, patch),
  }), [id, chave]);
  const ed = useFichaEditavel(id, transporte);
  const f = ed.ficha;
  /* Só depois do aperto de mão a ficha sabe para qual origem falar. Nunca envia para '*'. */
  const pai = useRef<string | null>(null);
  const [urlRetrato, setUrlRetrato] = useState<string>();

  useEffect(() => {
    function aoReceber(ev: MessageEvent) {
      if (ev.source !== window.parent || window.parent === window) return;
      if (!origemPermitida(ev.origin, origens) || ev.data?.tipo !== 'tablebola:ola') return;
      pai.current = ev.origin;
      window.parent.postMessage({ tipo: 'oh:pronto', schemaVersion: VERSAO_ESQUEMA, fichaId: id }, ev.origin);
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [id, origens]);

  const vidaAtual = f?.vidaAtual, manaAtual = f?.manaAtual, fotoV = f?.fotoV;
  useEffect(() => {
    if (!pai.current || !f) return;
    window.parent.postMessage({ tipo: 'oh:recursos', schemaVersion: VERSAO_ESQUEMA, fichaId: id, recursos: recursosDaFicha(f) }, pai.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só avisa quando vida ou mana mudam, não a cada leitura da ficha
  }, [id, vidaAtual, manaAtual]);

  /* Uma tag <img> não envia a chave: o retrato é buscado à parte e mostrado por uma URL local. */
  useEffect(() => {
    if (!fotoV) return;
    let cancelado = false, local: string | undefined;
    fetch(`/api/integracao/fichas/${id}/retrato`, { headers: chave ? { Authorization: `Bearer ${chave}` } : {} })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => {
        if (!b || cancelado) return;
        local = URL.createObjectURL(b);
        setUrlRetrato(local);
      })
      .catch(() => { /* sem o retrato, a ficha mostra a inicial do nome */ });
    return () => {
      cancelado = true;
      if (local) URL.revokeObjectURL(local);
      setUrlRetrato(undefined);
    };
  }, [id, chave, fotoV]);

  const embutido = useMemo(() => ({
    urlRetrato,
    aoRolar: (acao: { id: string; rotulo: string; expressao: string }) => {
      if (!pai.current) { toast.error('Esta ficha não está conectada a uma sala do Tablebola, então a rolagem não foi enviada.'); return; }
      window.parent.postMessage({ tipo: 'oh:rolagem', schemaVersion: VERSAO_ESQUEMA, fichaId: id, acao: acao.id, rotulo: acao.rotulo, expressao: acao.expressao }, pai.current);
    },
  }), [id, urlRetrato]);

  if (ed.erro && !f) {
    return (
      <section className="vazio">
        <h2>Não consegui abrir esta ficha</h2>
        <p>{mensagem(ed.erro)}</p>
      </section>
    );
  }
  if (!f) return <p className="apagado">Abrindo a ficha…</p>;
  return <EditorFicha f={f} ed={ed} embutido={embutido} />;
}
