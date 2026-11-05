'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { BotaoConfirmar } from '@/components/comuns';
import { api, buscar, dataCurta, mensagem } from '@/lib/cliente';
import type { ChaveIntegracao } from '@/lib/tipos';

/* Só busca as chaves quando o dono abre o painel: a ficha é aberta muito mais vezes do que isto é usado. */
export default function ChavesIntegracao({ fichaId }: { fichaId: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="integracao" onToggle={ev => setAberto(ev.currentTarget.open)}>
      <summary>Integração com o Tablebola</summary>
      {aberto && <Painel fichaId={fichaId} />}
    </details>
  );
}

function Painel({ fichaId }: { fichaId: string }) {
  const url = `/api/fichas/${fichaId}/chaves`;
  const { data, mutate } = useSWR<{ chaves: ChaveIntegracao[] }>(url, buscar);
  const [rotulo, setRotulo] = useState('');
  const [segredo, setSegredo] = useState<string | null>(null);

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      const r = await api<{ segredo: string }>('POST', url, { rotulo });
      setSegredo(r.segredo);
      setRotulo('');
      await mutate();
    } catch (e) { toast.error(mensagem(e)); }
  }
  async function revogar(id: string) {
    try {
      await api('DELETE', `${url}/${id}`);
      await mutate();
      toast.success('Chave revogada. Ela parou de funcionar.');
    } catch (e) { toast.error(mensagem(e)); }
  }

  return (
    <div className="integracao-corpo">
      <p className="formula">Quem tiver a chave vê a ficha inteira e pode alterar a vida e a mana atuais. Só dê a quem você confia.</p>
      <form className="campo" onSubmit={criar}>
        <label className="rotulo" htmlFor="c-chave-rotulo">Nome da nova chave</label>
        <input id="c-chave-rotulo" type="text" maxLength={60} placeholder="Ex.: Mesa de sexta" value={rotulo} onChange={ev => setRotulo(ev.target.value)} />
        <button type="submit" className="btn" disabled={!rotulo.trim()}>Criar chave</button>
      </form>
      {segredo && (
        <div className="chave-nova">
          <p className="formula"><b>Copie agora:</b> estes valores não aparecem de novo.</p>
          <label className="rotulo" htmlFor="c-chave-segredo">Chave</label>
          <input id="c-chave-segredo" type="text" readOnly value={segredo} onFocus={ev => ev.target.select()} />
          <label className="rotulo" htmlFor="c-chave-link">Link da ficha embutida</label>
          <input id="c-chave-link" type="text" readOnly value={`${window.location.origin}/embutido/fichas/${fichaId}#chave=${segredo}`} onFocus={ev => ev.target.select()} />
        </div>
      )}
      <ul className="lista-chaves">
        {data?.chaves.map(c => (
          <li key={c.id}>
            <span>{c.rotulo}<small>{dataCurta(c.criadoEm)}</small></span>
            <BotaoConfirmar rotulo="Revogar" confirmar="Confirmar" aoConfirmar={() => revogar(c.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
