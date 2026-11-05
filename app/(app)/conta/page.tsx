'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { BotaoConfirmar } from '@/components/comuns';
import { api, buscar, mensagem } from '@/lib/cliente';
import type { Usuario } from '@/lib/tipos';

export default function PaginaConta() {
  const router = useRouter();
  const { data, mutate } = useSWR<{ usuario: Usuario }>('/api/conta', buscar);
  const senhaExcluir = useRef<HTMLInputElement>(null);
  const [erroExcluir, setErroExcluir] = useState('');
  const u = data?.usuario;
  if (!u) return <p className="apagado">Abrindo sua conta…</p>;

  return (
    <>
      <header className="pag-topo">
        <div>
          <h1 className="pag-titulo">Minha conta</h1>
          <p className="pag-sub">{u.email}</p>
        </div>
      </header>
      <div className="conta-grade">
        <form className="painel" onSubmit={async ev => {
          ev.preventDefault();
          try {
            await api('PATCH', '/api/conta', Object.fromEntries(new FormData(ev.currentTarget)));
            await mutate();
            router.refresh();
            toast.success('Nome atualizado.');
          } catch (e) { toast.error(mensagem(e)); }
        }}>
          <h2 className="titulo-grupo">Seu nome na mesa</h2>
          <div className="campo">
            <label className="rotulo" htmlFor="conta-nome">Nome</label>
            <input id="conta-nome" name="nome" defaultValue={u.nome} key={u.nome} required minLength={2} maxLength={60} />
          </div>
          <button className="btn">Salvar nome</button>
        </form>

        <form className="painel" onSubmit={async ev => {
          ev.preventDefault();
          const form = ev.currentTarget;
          try {
            await api('POST', '/api/conta/senha', Object.fromEntries(new FormData(form)));
            form.reset();
            toast.success('Senha trocada. Os outros aparelhos foram desconectados.');
          } catch (e) { toast.error(mensagem(e)); }
        }}>
          <h2 className="titulo-grupo">Trocar senha</h2>
          <div className="campo">
            <label className="rotulo" htmlFor="senha-atual">Senha atual</label>
            <input id="senha-atual" name="atual" type="password" required autoComplete="current-password" />
          </div>
          <div className="campo">
            <label className="rotulo" htmlFor="senha-nova">Nova senha (pelo menos 8 caracteres)</label>
            <input id="senha-nova" name="nova" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <button className="btn">Trocar senha</button>
        </form>

        <section className="painel">
          <h2 className="titulo-grupo">Excluir conta</h2>
          <p className="apagado">Apaga suas fichas e as campanhas em que você é mestre. Os jogadores dessas campanhas continuam com as próprias fichas.</p>
          <div className="campo">
            <label className="rotulo" htmlFor="senha-excluir">Sua senha, para confirmar</label>
            <input id="senha-excluir" ref={senhaExcluir} type="password" autoComplete="current-password" />
          </div>
          {erroExcluir && <p className="erro-form" role="alert">{erroExcluir}</p>}
          <BotaoConfirmar rotulo="Excluir minha conta" confirmar="Confirmar: excluir para sempre" aoConfirmar={async () => {
            setErroExcluir('');
            try {
              await api('DELETE', '/api/conta', { senha: senhaExcluir.current?.value ?? '' });
              window.location.assign('/entrar');
            } catch (e) { setErroExcluir(mensagem(e)); }
          }} />
        </section>
      </div>
    </>
  );
}
