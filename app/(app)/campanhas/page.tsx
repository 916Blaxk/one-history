'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { Capitular } from '@/components/comuns';
import { api, buscar, mensagem } from '@/lib/cliente';
import type { ResumoCampanha } from '@/lib/tipos';

function ListaCampanhas({ titulo, lista, vazio }: { titulo: string; lista: ResumoCampanha[]; vazio: string }) {
  return (
    <section className="secao">
      <h2 className="titulo-grupo">{titulo}</h2>
      {lista.length === 0
        ? <p className="apagado">{vazio}</p>
        : (
          <ul>
            {lista.map(c => (
              <li className="rol-item" key={c.id}>
                <Link className="camp-linha" href={`/campanhas/${c.id}`}>
                  <Capitular nome={c.nome} />
                  <span>
                    <span className="rol-nome">{c.nome}</span>
                    <span className="rol-meta">Mestre: {c.mestreNome}</span>
                    {c.descricao && <span className="camp-desc">{c.descricao}</span>}
                  </span>
                  <span className="camp-num">
                    {c.jogadores} {c.jogadores === 1 ? 'jogador' : 'jogadores'} · {c.fichas} {c.fichas === 1 ? 'ficha' : 'fichas'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

export default function PaginaCampanhas() {
  const router = useRouter();
  const { data, isLoading } = useSWR<{ mestre: ResumoCampanha[]; jogador: ResumoCampanha[] }>('/api/campanhas', buscar);
  const [erroCriar, setErroCriar] = useState('');
  const [criando, setCriando] = useState(false);
  const [codigo, setCodigo] = useState('');

  async function criar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErroCriar('');
    setCriando(true);
    try {
      const { campanha } = await api<{ campanha: { id: string } }>('POST', '/api/campanhas', Object.fromEntries(new FormData(ev.currentTarget)));
      router.push(`/campanhas/${campanha.id}`);
    } catch (e) {
      setErroCriar(mensagem(e));
      setCriando(false);
    }
  }

  return (
    <>
      <header className="pag-topo">
        <div>
          <h1 className="pag-titulo">Campanhas</h1>
          <p className="pag-sub">Abra uma mesa como mestre ou entre na de outra pessoa com o código do convite.</p>
        </div>
      </header>

      <div className="duas-acoes">
        <form className="painel" onSubmit={criar}>
          <h2 className="titulo-grupo">Criar campanha</h2>
          <div className="campo">
            <label className="rotulo" htmlFor="camp-nome">Nome</label>
            <input id="camp-nome" name="nome" required minLength={2} maxLength={80} />
          </div>
          <div className="campo">
            <label className="rotulo" htmlFor="camp-desc">Descrição (opcional)</label>
            <input id="camp-desc" name="descricao" maxLength={600} />
          </div>
          {erroCriar && <p className="erro-form" role="alert">{erroCriar}</p>}
          <button className="btn btn-forte" disabled={criando}>Criar e virar mestre</button>
        </form>
        <form className="painel" onSubmit={ev => {
          ev.preventDefault();
          const c = codigo.trim();
          if (c) router.push(`/convite/${encodeURIComponent(c)}`);
        }}>
          <h2 className="titulo-grupo">Entrar em uma campanha</h2>
          <div className="campo">
            <label className="rotulo" htmlFor="camp-codigo">Código do convite</label>
            <input id="camp-codigo" required value={codigo} autoComplete="off" onChange={ev => setCodigo(ev.target.value.toUpperCase())} placeholder="Peça ao mestre" />
          </div>
          <button className="btn">Continuar</button>
        </form>
      </div>

      {isLoading
        ? <p className="apagado">Abrindo suas campanhas…</p>
        : (
          <>
            <ListaCampanhas titulo="Como mestre" lista={data?.mestre ?? []} vazio="Você ainda não abriu nenhuma campanha." />
            <ListaCampanhas titulo="Como jogador" lista={data?.jogador ?? []} vazio="Você ainda não entrou em nenhuma campanha." />
          </>
        )}
    </>
  );
}
