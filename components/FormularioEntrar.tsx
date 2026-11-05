'use client';
import { useState } from 'react';
import { api, mensagem } from '@/lib/cliente';

export default function FormularioEntrar({ destino, convite }: { destino: string; convite: boolean }) {
  const [modo, setModo] = useState<'entrar' | 'cadastro'>(convite ? 'cadastro' : 'entrar');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cadastro = modo === 'cadastro';

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api('POST', cadastro ? '/api/conta/cadastro' : '/api/conta/entrar', Object.fromEntries(new FormData(ev.currentTarget)));
      window.location.assign(destino);
    } catch (e) {
      setErro(mensagem(e));
      setEnviando(false);
    }
  }

  return (
    <section className="cartao-entrada">
      {convite && <p className="aviso-convite">Você recebeu um convite para uma campanha. Entre ou crie uma conta para aceitar.</p>}
      <div className="abas" role="tablist" aria-label="Entrar ou criar conta">
        <button type="button" role="tab" className="aba" aria-selected={!cadastro} onClick={() => { setModo('entrar'); setErro(''); }}>Entrar</button>
        <button type="button" role="tab" className="aba" aria-selected={cadastro} onClick={() => { setModo('cadastro'); setErro(''); }}>Criar conta</button>
      </div>
      <form className="form" onSubmit={enviar}>
        {cadastro && (
          <div className="campo">
            <label className="rotulo" htmlFor="nome">Seu nome na mesa</label>
            <input id="nome" name="nome" required minLength={2} maxLength={60} autoComplete="nickname" />
          </div>
        )}
        <div className="campo">
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="campo">
          <label className="rotulo" htmlFor="senha">Senha{cadastro ? ' (pelo menos 8 caracteres)' : ''}</label>
          <input id="senha" name="senha" type="password" required minLength={cadastro ? 8 : undefined} autoComplete={cadastro ? 'new-password' : 'current-password'} />
        </div>
        {erro && <p className="erro-form" role="alert">{erro}</p>}
        <button className="btn btn-forte" disabled={enviando}>{cadastro ? 'Criar conta' : 'Entrar'}</button>
      </form>
    </section>
  );
}
