'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Paintbrush, Volume2, VolumeX } from 'lucide-react';
import { DADOS, inteiro } from '@/lib/regras';
import type { Mensagem } from '@/lib/tipos';
import { urlBanner } from '@/lib/cliente';
import type { ChatDados, RolagemPendente } from '@/lib/useChat';
import { useEstiloDado, useSomCritico } from '@/lib/tema';
import { ESTILOS_DADO, estiloDado } from '@/lib/estilos';
import { tocarSolo } from '@/lib/solo';
import { extremoDaRolagem, separarDetalhe, type DetalheSeparado } from '@/lib/extremo';
import { Capitular } from './comuns';
import { IconeDado, coresDoEstilo } from './IconeDado';
import ChamasCritico from './ChamasCritico';

const horaCurta = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function nomeDoDia(ms: number) {
  const dia = new Date(ms).toDateString();
  const hoje = new Date();
  if (dia === hoje.toDateString()) return 'Hoje';
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (dia === ontem.toDateString()) return 'Ontem';
  return new Date(ms).toLocaleDateString('pt-BR');
}

/* ---------- Rolagem extrema ----------
   Máximo no dado: chamas sobem das bordas na cor do ícone de quem rolou, a ficha treme e toca um solo
   de guitarra. Nada aparece no meio da tela. 1 no dado: a tela perde a cor por um instante.
   Só na rolagem da própria pessoa: a de outro jogador mostra o cartão marcado, sem tomar a tela. */
function corDoTema(nome: string, reserva: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva;
}

function EfeitoTela({ chat }: { chat: ChatDados }) {
  const { efeito, setEfeito } = chat;
  const { meu } = useEstiloDado();
  const [som] = useSomCritico();
  /* Lido por ref: ligar ou desligar o som no meio das chamas não pode tocar o solo de novo. */
  const somLigado = useRef(som);
  useEffect(() => { somLigado.current = som; });
  useEffect(() => {
    if (!efeito) return;
    const raiz = document.documentElement;
    const classe = efeito.tipo === 'critico' ? 'tremor-critico' : 'tremor-falha';
    raiz.classList.add(classe);
    let fim: ReturnType<typeof setTimeout> | undefined;
    if (efeito.tipo === 'critico') { if (somLigado.current) tocarSolo(); }
    else fim = setTimeout(() => setEfeito(null), 900);
    return () => { clearTimeout(fim); raiz.classList.remove(classe); };
  }, [efeito, setEfeito]);
  if (!efeito) return null;
  /* Sem ícone escolhido, o fogo segue a cor do tema do site. */
  const e = estiloDado(meu);
  const cor = e?.cor ?? corDoTema('--secondary', '#8f6bff'), claro = e?.claro ?? corDoTema('--secondary-claro', '#d04dff');
  return createPortal(
    efeito.tipo === 'critico'
      ? <ChamasCritico key={efeito.id} cor={cor} claro={claro} aoTerminar={() => setEfeito(null)} />
      : <div key={efeito.id} className="efeito-falha" aria-hidden="true" />,
    document.body,
  );
}

/* O número gira enquanto a resposta do servidor não chega. */
function NumeroGirando({ teto }: { teto: number }) {
  const [n, setN] = useState(() => Math.floor(Math.random() * teto) + 1);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const giro = setInterval(() => setN(Math.floor(Math.random() * teto) + 1), 50);
    return () => clearInterval(giro);
  }, [teto]);
  return <span aria-hidden="true">{n}</span>;
}

/* O cartão leva o ícone e as cores de quem rolou, para todos que o veem: o ícone é a assinatura do jogador. */
function CartaoRolagem({ m, nova }: { m: Mensagem; nova: boolean }) {
  const banner = m.bannerV ? { '--banner': `url("${urlBanner(m.id, m.bannerV)}")` } as React.CSSProperties : undefined;
  const partes = separarDetalhe(m.det);
  const extremo = extremoDaRolagem(m.det);
  return (
    <li className={`cartao-linha msg${m.minha ? ' msg-minha' : ''}${nova ? ' msg-nova' : ''}`} data-estilo={m.estilo ?? 'tema'} style={coresDoEstilo(m.estilo)} data-extremo={extremo ?? undefined}>
      {!m.minha && <Capitular className="msg-foto" nome={m.autor} fichaId={m.fichaId ?? undefined} fotoV={m.fotoV} />}
      <div className={`cartao msg-balao${m.dano ? ' cartao-duplo' : ''}${banner ? ' msg-com-banner' : ''}`} style={banner}>
        <span className="cartao-icone"><IconeDado estilo={m.estilo} /></span>
        <div className="cartao-meio">
          <p className="cartao-titulo">
            {m.rotulo ? <span className="msg-rotulo">{m.rotulo}</span> : <span aria-hidden="true">{partes?.expr ?? 'Rolagem'}</span>}
            {extremo && <span className="cartao-selo">{extremo === 'critico' ? 'Crítico' : 'Falha'}</span>}
          </p>
          {/* O texto original fica para leitores de tela; a versão em colchetes é só visual. */}
          <span className="msg-det so-leitor">{m.det}</span>
          {m.dano && <span className="so-leitor">Acerto {m.total}. Dano: {m.dano.det} = {m.dano.total}.</span>}
          <DadosVisuais det={m.det} partes={partes} />
          {m.dano && <DadosVisuais det={m.dano.det} partes={separarDetalhe(m.dano.det)} prefixo="dano" />}
          <p className="cartao-autor"><span className="msg-autor">{m.autor}</span> · <time className="msg-hora">{horaCurta(m.em)}</time></p>
        </div>
        {m.dano ? (
          /* Ataque e habilidade: acerto à esquerda, dano à direita, como no C.R.I.S. */
          <>
            <span className="cartao-par"><span className="cartao-total msg-total">{m.total}</span><small aria-hidden="true">Acerto</small></span>
            <span className="cartao-divisor" aria-hidden="true" />
            <span className="cartao-par cartao-par-dano" aria-hidden="true"><span className="cartao-total">{m.dano.total}</span><small>Dano</small></span>
          </>
        ) : (
          <>
            <span className="cartao-igual" aria-hidden="true">=</span>
            <span className="cartao-total msg-total">{m.total}</span>
          </>
        )}
      </div>
    </li>
  );
}

/* A linha dos dados no estilo do C.R.I.S: a expressão pequena e os dados entre colchetes. */
function DadosVisuais({ det, partes, prefixo }: { det: string; partes: DetalheSeparado | null; prefixo?: string }) {
  return (
    <p className="cartao-dados" aria-hidden="true">
      {prefixo && <span className="cartao-prefixo">{prefixo} </span>}
      {partes ? (
        <>
          <span className="cartao-expr">{partes.expr}{partes.maior && <small> maior</small>}</span>{' '}
          [{partes.valores.map((v, i) => (
            <Fragment key={i}>{i > 0 && ', '}<span className={partes.guardado >= 0 && i !== partes.guardado ? 'cartao-fora' : undefined}>{v}</span></Fragment>
          ))}]{partes.resto && <> {partes.resto}</>}
        </>
      ) : det}
    </p>
  );
}

/* O cartão que aparece no clique, antes de o servidor responder. */
function CartaoPendente({ p, estilo }: { p: RolagemPendente; estilo: string | null }) {
  return (
    <li className="cartao-linha cartao-pendente msg-minha" data-estilo={estilo ?? 'tema'} style={coresDoEstilo(estilo)} aria-label="Rolando os dados">
      <div className="cartao">
        <span className="cartao-icone"><IconeDado estilo={estilo} /></span>
        <div className="cartao-meio">
          <p className="cartao-titulo">{p.rotulo}</p>
          <p className="cartao-dados">rolando…</p>
        </div>
        {p.comDano ? (
          <>
            <span className="cartao-par"><span className="cartao-total"><NumeroGirando teto={p.lados} /></span><small>Acerto</small></span>
            <span className="cartao-divisor" aria-hidden="true" />
            <span className="cartao-par cartao-par-dano"><span className="cartao-total"><NumeroGirando teto={12} /></span><small>Dano</small></span>
          </>
        ) : (
          <>
            <span className="cartao-igual" aria-hidden="true">=</span>
            <span className="cartao-total"><NumeroGirando teto={p.lados} /></span>
          </>
        )}
      </div>
    </li>
  );
}

/* Os ícones dos dados, só o desenho, sem nome. Ícone com cadeado já é de outra pessoa e não pode ser escolhido.
   O nome fica no título e no leitor de tela. */
function EscolhaEstilo() {
  const { meu, ocupados, carregado, escolher, atualizar } = useEstiloDado();
  /* A lista de ocupados muda quando outras pessoas escolhem: abrir o painel busca a versão nova. */
  useEffect(() => { void atualizar(); }, [atualizar]);
  const opcoes = [{ id: null, nome: 'D20 do tema (de todos)' }, ...ESTILOS_DADO];
  return (
    <div className="estilos" role="radiogroup" aria-label="Ícone dos seus dados" aria-busy={!carregado}>
      {opcoes.map(e => {
        const ocupado = !!e.id && ocupados.includes(e.id);
        return (
          <button
            key={e.id ?? 'tema'} type="button" role="radio" aria-checked={meu === e.id} className="estilo-opcao"
            data-estilo={e.id ?? 'tema'} style={coresDoEstilo(e.id)} disabled={ocupado || !carregado}
            title={ocupado ? `${e.nome}: já é de outra pessoa` : e.nome} aria-label={ocupado ? `${e.nome}, já é de outra pessoa` : e.nome}
            onClick={() => { if (meu !== e.id) void escolher(e.id); }}
          >
            <span className="cartao-icone"><IconeDado estilo={e.id} /></span>
            {ocupado && <Lock className="estilo-cadeado" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/* Histórico e dados. É usado dentro da janela flutuante da ficha e no painel da campanha. */
export function CorpoChat({ chat, aoRolar }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  const [bonus, setBonus] = useState('0');
  const { meu: estilo } = useEstiloDado();
  const { mensagens, carregando, pendente } = chat;

  /* Mensagens de antes de abrir o chat entram paradas. Só as que chegam depois têm animação. */
  const [corte, setCorte] = useState<number | null>(null);
  if (corte === null && !carregando) setCorte(mensagens.at(-1)?.em ?? 0);

  const primeiraId = mensagens[0]?.id;
  const ultimaId = pendente && !pendente.popup ? `pendente-${pendente.id}` : mensagens.at(-1)?.id;
  const alturaAntes = useRef(0);
  const primeiraAntes = useRef<string | undefined>(undefined);
  const ultimaAntes = useRef<string | undefined>(undefined);
  const colado = useRef(true);

  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    if (primeiraAntes.current && primeiraId !== primeiraAntes.current && ultimaId === ultimaAntes.current) {
      /* Carregou mensagens antigas no topo: mantém a pessoa olhando para o mesmo ponto. */
      el.scrollTop += el.scrollHeight - alturaAntes.current;
    } else if (ultimaId !== ultimaAntes.current && (colado.current || mensagens.at(-1)?.minha || pendente)) {
      el.scrollTop = el.scrollHeight;
      colado.current = true;
    }
    alturaAntes.current = el.scrollHeight;
    primeiraAntes.current = primeiraId;
    ultimaAntes.current = ultimaId;
  });

  return (
    <>
      <div className="chat-lista" ref={lista} onScroll={e => {
        const el = e.currentTarget;
        colado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}>
        {chat.temMais && (
          <button type="button" className="btn btn-pequeno chat-mais" disabled={chat.carregandoAntigas} onClick={chat.carregarAnteriores}>
            {chat.carregandoAntigas ? 'Carregando…' : 'Carregar rolagens anteriores'}
          </button>
        )}
        {mensagens.length === 0 && !pendente && (
          <p className="chat-vazio">{carregando ? 'Abrindo o histórico…' : 'Nenhuma rolagem ainda. Escolha um dado abaixo ou clique em d20 ao lado de um atributo da ficha.'}</p>
        )}
        <ul role="log" aria-live="polite" aria-label="Histórico de rolagens">
          {mensagens.map((m, i) => {
            const dia = nomeDoDia(m.em);
            const separador = i === 0 || dia !== nomeDoDia(mensagens[i - 1]!.em);
            return (
              <Fragment key={m.id}>
                {separador && <li className="chat-dia"><span>{dia}</span></li>}
                <CartaoRolagem m={m} nova={corte !== null && m.em > corte} />
              </Fragment>
            );
          })}
          {pendente && !pendente.popup && <CartaoPendente key={`pendente-${pendente.id}`} p={pendente} estilo={estilo} />}
        </ul>
      </div>
      <div className="chat-rolar">
        <div className="dados-botoes">
          {DADOS.map(n => <button type="button" key={n} aria-label={`Rolar d${n}`} onClick={() => aoRolar(n, inteiro(bonus, -999, 999))}>d{n}</button>)}
        </div>
        <label className="bonus" htmlFor="chat-bonus">Bônus <input id="chat-bonus" type="number" value={bonus} onChange={e => setBonus(e.target.value)} /></label>
      </div>
    </>
  );
}

/* Só o resultado da última rolagem, sem o histórico. Não some sozinho: a pessoa pode estar olhando para outra parte da ficha.
   É o mesmo elemento do clique até a resposta: a animação de entrada roda uma vez só, e o número para no lugar. */
function PopupRolagem({ m, pendente, aoFechar }: { m: Mensagem | null; pendente: RolagemPendente | null; aoFechar: () => void }) {
  const { meu: estilo } = useEstiloDado();
  return (
    <section className="chat-popup" role="status" aria-label="Última rolagem">
      <button type="button" className="chat-fechar" aria-label="Fechar o resultado da rolagem" onClick={aoFechar}>×</button>
      <ul>
        {pendente
          ? <CartaoPendente key={`pendente-${pendente.id}`} p={pendente} estilo={estilo} />
          : m && <CartaoRolagem key={m.id} m={m} nova />}
      </ul>
    </section>
  );
}

/* Painel lateral da ficha: mostra o pop-up ao rolar, abre pela pílula e avisa quando chega rolagem de outra pessoa com ela fechada. */
export function ChatFlutuante({ chat, aoRolar, escopo }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void; escopo: string }) {
  const { aberto, setAberto, mensagens, carregando, destaque, setDestaque, pendente } = chat;
  const [som, setSom] = useSomCritico();
  const [personalizando, setPersonalizando] = useState(false);
  /* O chat inteiro já mostra o resultado: fechar o chat não traz de volta um pop-up antigo. */
  if (aberto && destaque) setDestaque(null);
  const [visto, setVisto] = useState<number | null>(null);
  const ultima = mensagens.at(-1)?.em ?? 0;
  if (visto === null && !carregando) setVisto(ultima);
  else if (aberto && visto !== null && ultima > visto) setVisto(ultima);
  const corteVisto = visto ?? Infinity;
  const naoLidas = aberto ? 0 : mensagens.filter(m => !m.minha && m.em > corteVisto).length;

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, setAberto]);

  if (!aberto) {
    const popupPendente = pendente?.popup ? pendente : null;
    return (
      <>
        <EfeitoTela chat={chat} />
        {(popupPendente || destaque) && <PopupRolagem m={destaque} pendente={popupPendente} aoFechar={() => setDestaque(null)} />}
        <button type="button" className="chat-pilula" aria-expanded="false" onClick={() => setAberto(true)}>
          <span className="chat-pilula-texto">Chat de dados</span>
          {naoLidas > 0 && <span className="chat-contagem" aria-label={`${naoLidas} ${naoLidas === 1 ? 'rolagem nova' : 'rolagens novas'}`}>{naoLidas}</span>}
        </button>
      </>
    );
  }
  /* Os jogadores pediram o chat na lateral, como no C.R.I.S: a mesma aba que abre fica presa na borda do painel e o recolhe. */
  return (
    <>
    <EfeitoTela chat={chat} />
    <section className="chat-flutuante" aria-label="Chat de dados">
      <button type="button" className="chat-pilula chat-pilula-aberta" aria-expanded="true" aria-label="Recolher o chat de dados" onClick={() => setAberto(false)}>
        <span className="chat-pilula-texto" aria-hidden="true">Chat de dados</span>
      </button>
      <header className="chat-cab">
        <div>
          <h2 className="titulo-grupo">Chat de dados</h2>
          <p className="chat-escopo">{escopo}</p>
        </div>
        <div className="chat-cab-acoes">
          <button type="button" className="chat-acao" aria-label="Personalizar os dados" aria-expanded={personalizando} title="Personalizar os dados" onClick={() => setPersonalizando(v => !v)}>
            <Paintbrush aria-hidden="true" />
          </button>
          <button type="button" className="chat-fechar" aria-label="Fechar o chat de dados" onClick={() => setAberto(false)}>×</button>
        </div>
      </header>
      {personalizando && (
        <div className="chat-personalizar">
          <p className="rotulo">Ícone dos seus dados</p>
          <EscolhaEstilo />
          <button type="button" className="estilo-som" aria-pressed={som} onClick={() => setSom(!som)}>
            {som ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            {som ? 'Solo de guitarra no crítico: ligado' : 'Solo de guitarra no crítico: desligado'}
          </button>
        </div>
      )}
      <CorpoChat chat={chat} aoRolar={aoRolar} />
    </section>
    </>
  );
}
