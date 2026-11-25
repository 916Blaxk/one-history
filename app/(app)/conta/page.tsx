'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import AjusteFoto, { fotoDaTela } from '@/components/AjusteFoto';
import { BotaoConfirmar } from '@/components/comuns';
import { api, buscar, mensagem, MOLDURA_BANNER } from '@/lib/cliente';
import type { Usuario } from '@/lib/tipos';

export default function PaginaConta() {
  const router = useRouter();
  const { data, mutate } = useSWR<{ usuario: Usuario }>('/api/conta', buscar);
  const senhaExcluir = useRef<HTMLInputElement>(null);
  const [erroExcluir, setErroExcluir] = useState('');
  const entradaBanner = useRef<HTMLInputElement>(null);
  const [bannerEscolhido, setBannerEscolhido] = useState<File | null>(null);
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

        <section className="painel">
          <h2 className="titulo-grupo">Banner das rolagens</h2>
          <p className="apagado">Aparece no fundo das suas rolagens no chat de dados, em todas as fichas e campanhas.</p>
          <div className="banner-previa" role="img" aria-label={u.bannerV ? 'Seu banner atual' : 'Sem banner'}
            style={u.bannerV ? { backgroundImage: `url("/api/conta/banner?v=${u.bannerV}")` } : undefined}>
            {!u.bannerV && 'Sem banner'}
          </div>
          <div className="banner-botoes">
            <button type="button" className="btn" onClick={() => entradaBanner.current?.click()}>{u.bannerV ? 'Trocar banner' : 'Enviar banner'}</button>
            {u.bannerV > 0 && <button type="button" className="btn" onClick={async () => {
              try {
                await mutate(await api<{ usuario: Usuario }>('DELETE', '/api/conta/banner'), { revalidate: false });
                toast.success('Banner removido.');
              } catch (e) { toast.error(mensagem(e)); }
            }}>Remover</button>}
          </div>
          <input ref={entradaBanner} type="file" accept="image/*" hidden aria-label="Imagem do banner" onChange={ev => {
            const a = ev.target.files?.[0];
            ev.target.value = '';
            if (a) setBannerEscolhido(a);
          }} />
          {bannerEscolhido && (
            <AjusteFoto
              key={`${bannerEscolhido.name}-${bannerEscolhido.lastModified}`}
              arquivo={bannerEscolhido}
              titulo="Ajustar o banner"
              moldura={MOLDURA_BANNER}
              aoCancelar={() => setBannerEscolhido(null)}
              aoFalhar={() => { setBannerEscolhido(null); toast.error('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.'); }}
              aoSalvar={async tela => {
                setBannerEscolhido(null);
                try {
                  await mutate(await api<{ usuario: Usuario }>('POST', '/api/conta/banner', { banner: fotoDaTela(tela) }), { revalidate: false });
                  toast.success('Banner salvo. As suas rolagens já aparecem com ele.');
                } catch (e) { toast.error(mensagem(e)); }
              }}
            />
          )}
        </section>

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
