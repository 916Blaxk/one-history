'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CorpoChat } from '@/components/Chat';
import { BotaoConfirmar } from '@/components/comuns';
import { CabecalhoRol, LinhaFicha } from '@/components/LinhaFicha';
import { api, buscar, mensagem } from '@/lib/cliente';
import type { DetalheCampanha, Ficha, Mensagem } from '@/lib/tipos';
import { useChat } from '@/lib/useChat';

export default function PaginaCampanha() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const url = `/api/campanhas/${id}`;
  /* Atualiza sozinha a cada 3 segundos: é assim que o mestre vê a mesa e as rolagens ao vivo. */
  const { data, error, mutate } = useSWR<DetalheCampanha>(url, buscar, { refreshInterval: 3000, shouldRetryOnError: false });
  const chat = useChat(`${url}/chat`);
  const [escolhida, setEscolhida] = useState('');
  const [editando, setEditando] = useState(false);

  async function agir(fn: () => Promise<unknown>, sucesso?: string) {
    try {
      await fn();
      if (sucesso) toast.success(sucesso);
      await mutate();
    } catch (e) { toast.error(mensagem(e)); }
  }

  if (error && !data) {
    return (
      <section className="vazio">
        <h2>Não consegui abrir esta campanha</h2>
        <p>{mensagem(error)}</p>
        <Link className="btn" href="/campanhas">Voltar para campanhas</Link>
      </section>
    );
  }
  if (!data) return <p className="apagado">Abrindo a campanha…</p>;

  const { campanha: c, papel, membros, fichas, minhasLivres } = data;
  const souMestre = papel === 'mestre';
  const linkConvite = c.codigo ? `${window.location.origin}/convite/${c.codigo}` : '';

  async function copiar(texto: string, aviso: string) {
    try { await navigator.clipboard.writeText(texto); toast.success(aviso); }
    catch { toast.error('O navegador não deixou copiar. Selecione o texto e copie à mão.'); }
  }
  async function criarEAdicionar() {
    try {
      const { ficha } = await api<{ ficha: Ficha }>('POST', '/api/fichas');
      await api('POST', `${url}/fichas`, { fichaId: ficha.id });
      router.push(`/fichas/${ficha.id}`);
    } catch (e) { toast.error(mensagem(e)); }
  }
  const adicionar = () => {
    const fichaId = escolhida || minhasLivres[0]?.id;
    if (!fichaId) return;
    setEscolhida('');
    agir(() => api('POST', `${url}/fichas`, { fichaId }), 'Ficha adicionada à campanha.');
  };

  return (
    <>
      <header className="pag-topo">
        <div>
          <h1 className="pag-titulo">{c.nome}</h1>
          <p className="pag-sub">
            Mestre: {c.mestreNome} · {membros.length} {membros.length === 1 ? 'pessoa' : 'pessoas'}
            <span className="selo">{souMestre ? 'Você é o mestre' : 'Você é jogador'}</span>
          </p>
          {c.descricao && <p className="pag-sub">{c.descricao}</p>}
        </div>
        <div className="acoes">
          {/* Um link comum, não o do Next: a página da mesa troca a folha de estilos inteira. */}
          <a className="btn btn-forte" href={`/campanhas/${id}/mesa`}>Mesa</a>
          <Link className="btn" href="/campanhas">← Todas as campanhas</Link>
        </div>
      </header>

      <div className="camp-grade">
        <div>
          {!souMestre && !fichas.some(f => f.completo) && (
            <section className="painel" style={{ marginBottom: 18 }}>
              <h2 className="titulo-grupo">Traga seu personagem</h2>
              <p className="apagado">Você entrou na campanha, mas ainda não tem ficha nela. Escolha uma das suas ou crie uma nova.</p>
            </section>
          )}
          <div className="secao">
            <h2 className="titulo-grupo">Fichas na mesa</h2>
            {fichas.length === 0
              ? <p className="apagado">{souMestre ? 'Mande o convite: as fichas dos jogadores aparecem aqui assim que eles as adicionarem.' : 'Nenhuma ficha nesta campanha ainda.'}</p>
              : (
                <>
                  <CabecalhoRol comAcao />
                  <ul>
                    {fichas.map(f => (
                      <li className="rol-item rol-item-acao" key={f.id}>
                        <LinhaFicha f={f} meta={[f.privada === undefined ? `Jogador: ${f.donoNome}` : f.privada ? 'Privada: os jogadores não veem' : 'Pública: os jogadores veem nome, foto e raça', f.raca, f.estilo].filter(Boolean).join(' · ')} />
                        {/* O espaço fica reservado mesmo sem botão, para as colunas continuarem alinhadas com o cabeçalho. */}
                        <div className="rol-acao">
                          {f.privada !== undefined && (
                            <button type="button" className="btn btn-pequeno" onClick={() => agir(() => api('PATCH', `/api/fichas/${f.id}`, { publica: f.privada }), f.privada ? 'Agora os jogadores veem esta ficha.' : 'Agora os jogadores não veem esta ficha.')}>
                              {f.privada ? 'Tornar pública' : 'Tornar privada'}
                            </button>
                          )}
                          {f.completo && (
                            <BotaoConfirmar className="btn btn-pequeno" rotulo="Retirar" confirmar="Confirmar" aoConfirmar={() => agir(() => api('DELETE', `${url}/fichas/${f.id}`), 'Ficha retirada da campanha.')} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
          </div>
          <div className="linha-add">
            {minhasLivres.length > 0 && (
              <>
                <div className="campo">
                  <label className="rotulo" htmlFor="add-ficha">{souMestre ? 'Adicionar uma ficha sua (NPC)' : 'Adicionar uma ficha sua'}</label>
                  <select id="add-ficha" value={escolhida || minhasLivres[0].id} onChange={e => setEscolhida(e.target.value)}>
                    {minhasLivres.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-forte" onClick={adicionar}>Adicionar à campanha</button>
              </>
            )}
            <button type="button" className="btn" onClick={criarEAdicionar}>Criar ficha nova aqui</button>
          </div>
        </div>

        <div className="camp-lado">
          {souMestre && c.codigo && (
            <section className="painel">
              <h2 className="titulo-grupo">Convidar jogadores</h2>
              <p className="codigo" id="codigo-convite">{c.codigo}</p>
              <input id="link-convite" className="link-convite" readOnly value={linkConvite} aria-label="Link do convite" onFocus={e => e.target.select()} />
              <div className="acoes">
                <button type="button" className="btn btn-pequeno" onClick={() => copiar(linkConvite, 'Link copiado.')}>Copiar link</button>
                <button type="button" className="btn btn-pequeno" onClick={() => copiar(c.codigo!, 'Código copiado.')}>Copiar código</button>
                <BotaoConfirmar className="btn btn-pequeno" rotulo="Gerar novo código" confirmar="O antigo deixa de valer. Confirmar?" aoConfirmar={() => agir(() => api('POST', `${url}/codigo`), 'Novo código gerado.')} />
              </div>
            </section>
          )}

          <section className="painel chat-painel" aria-label="Chat de dados">
            <h2 className="titulo-grupo">Chat de dados</h2>
            <CorpoChat chat={chat} aoRolar={async (lados, bonus) => {
              try {
                const r = await api<{ rolagem: Mensagem }>('POST', `${url}/rolar`, { lados, bonus });
                chat.receber(r.rolagem);
              } catch (e) { toast.error(mensagem(e)); }
            }} />
          </section>

          <section className="painel">
            <h2 className="titulo-grupo">Pessoas</h2>
            <ul>
              {membros.map(m => (
                <li className="membro" key={m.id}>
                  <span className="membro-nome">{m.nome}{m.papel === 'mestre' && <span className="selo">Mestre</span>}</span>
                  {souMestre && m.papel !== 'mestre' && (
                    <BotaoConfirmar className="btn btn-pequeno" rotulo="Remover" confirmar="Confirmar" aoConfirmar={() => agir(() => api('DELETE', `${url}/membros/${m.id}`), `${m.nome} saiu da campanha.`)} />
                  )}
                </li>
              ))}
            </ul>
            {!souMestre && (
              <BotaoConfirmar rotulo="Sair da campanha" confirmar="Confirmar: sair e levar minhas fichas" aoConfirmar={async () => {
                try {
                  const eu_ = await api<{ usuario: { id: string } }>('GET', '/api/conta');
                  await api('DELETE', `${url}/membros/${eu_.usuario.id}`);
                  toast.success('Você saiu da campanha. Suas fichas continuam na sua conta.');
                  router.push('/campanhas');
                } catch (e) { toast.error(mensagem(e)); }
              }} />
            )}
          </section>

          {souMestre && (
            <section className="painel">
              <h2 className="titulo-grupo">Ajustes da campanha</h2>
              {editando
                ? (
                  <form className="form" onSubmit={async ev => {
                    ev.preventDefault();
                    const dados = Object.fromEntries(new FormData(ev.currentTarget));
                    await agir(() => api('PATCH', url, dados), 'Campanha atualizada.');
                    setEditando(false);
                  }}>
                    <div className="campo"><label className="rotulo" htmlFor="ajuste-nome">Nome</label><input id="ajuste-nome" name="nome" defaultValue={c.nome} required minLength={2} maxLength={80} /></div>
                    <div className="campo"><label className="rotulo" htmlFor="ajuste-desc">Descrição</label><textarea id="ajuste-desc" name="descricao" defaultValue={c.descricao} maxLength={600} /></div>
                    <div className="acoes"><button className="btn btn-forte">Salvar</button><button type="button" className="btn" onClick={() => setEditando(false)}>Cancelar</button></div>
                  </form>
                )
                : <button type="button" className="btn" onClick={() => setEditando(true)}>Editar nome e descrição</button>}
              <BotaoConfirmar rotulo="Excluir campanha" confirmar="Confirmar: excluir para sempre" aoConfirmar={async () => {
                try {
                  await api('DELETE', url);
                  toast.success('Campanha excluída. As fichas continuam com seus donos.');
                  router.push('/campanhas');
                } catch (e) { toast.error(mensagem(e)); }
              }} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
