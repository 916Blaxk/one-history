'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crown, Droplet, FlaskConical, Flame, Moon, Paintbrush, Snowflake } from 'lucide-react';
import { DADOS, inteiro } from '@/lib/regras';
import type { Mensagem } from '@/lib/tipos';
import { urlBanner } from '@/lib/cliente';
import type { ChatDados, RolagemPendente } from '@/lib/useChat';
import { ESTILOS_DADO, useEstiloDado, type EstiloDado } from '@/lib/tema';
import { Capitular } from './comuns';

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

/* ---------- Ícones dos estilos de dado ---------- */
function IconeD20() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M16 2 28.500 9v14L16 30 3.500 23V9z" />
      <path d="M16 9 23.500 21h-15zM16 2v7M3.500 9 16 9l12.500 0M3.500 23l5-2-5-12M28.500 23l-5-2 5-12M16 30l-7.500-9M16 30l7.500-9" />
    </svg>
  );
}
function IconeDemonio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2.500c-.4 4 1 6.500 3.600 7.700M20 2.500c.4 4-1 6.500-3.600 7.700" />
      <path d="M5.500 10.500C5.500 17 8.500 21.500 12 21.500s6.500-4.500 6.500-11c-1.700-1.300-4-2-6.500-2s-4.800.7-6.500 2z" />
      <path d="m8.200 13.200 2.600 1.300M15.800 13.200l-2.600 1.300M9.500 18c1.600.9 3.400.9 5 0" />
    </svg>
  );
}
function IconeEstilo({ estilo }: { estilo: EstiloDado }) {
  switch (estilo) {
    case 'demonio': return <IconeDemonio />;
    case 'brasa': return <Flame aria-hidden="true" />;
    case 'gelo': return <Snowflake aria-hidden="true" />;
    case 'veneno': return <FlaskConical aria-hidden="true" />;
    case 'sombra': return <Moon aria-hidden="true" />;
    case 'ouro': return <Crown aria-hidden="true" />;
    case 'sangue': return <Droplet aria-hidden="true" />;
    default: return <IconeD20 />;
  }
}

/* O detalhe vem pronto do servidor ("2d20, fica o maior (14, 7) + 3"). Aqui só é separado para
   mostrar como no C.R.I.S: a expressão pequena, os dados entre colchetes e o total grande. */
function separarDetalhe(det: string) {
  const m = det.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/);
  if (!m) return null;
  const maior = m[1]!.includes('fica o maior');
  const valores = m[2]!.split(',').map(v => v.trim()).filter(Boolean);
  /* No "fica o maior", só um dado conta: os outros aparecem apagados. */
  const guardado = maior ? valores.reduce((melhor, v, i) => (Number(v) > Number(valores[melhor]) ? i : melhor), 0) : -1;
  return { expr: m[1]!.replace(', fica o maior', ''), maior, valores, guardado, resto: m[3]! };
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

function CartaoRolagem({ m, nova, estilo }: { m: Mensagem; nova: boolean; estilo: EstiloDado }) {
  const banner = m.bannerV ? { '--banner': `url("${urlBanner(m.id, m.bannerV)}")` } as React.CSSProperties : undefined;
  const partes = separarDetalhe(m.det);
  const meuEstilo: EstiloDado = m.minha ? estilo : 'tema';
  return (
    <li className={`cartao-linha msg${m.minha ? ' msg-minha' : ''}${nova ? ' msg-nova' : ''}`} data-estilo={meuEstilo}>
      {!m.minha && <Capitular className="msg-foto" nome={m.autor} fichaId={m.fichaId ?? undefined} fotoV={m.fotoV} />}
      <div className={`cartao msg-balao${banner ? ' msg-com-banner' : ''}`} style={banner}>
        <span className="cartao-icone"><IconeEstilo estilo={meuEstilo} /></span>
        <div className="cartao-meio">
          <p className="cartao-titulo">
            {m.rotulo ? <span className="msg-rotulo">{m.rotulo}</span> : <span aria-hidden="true">{partes?.expr ?? 'Rolagem'}</span>}
          </p>
          {/* O texto original fica para leitores de tela; a versão em colchetes é só visual. */}
          <span className="msg-det so-leitor">{m.det}</span>
          <p className="cartao-dados" aria-hidden="true">
            {partes ? (
              <>
                <span className="cartao-expr">{partes.expr}{partes.maior && <small> maior</small>}</span>{' '}
                [{partes.valores.map((v, i) => (
                  <Fragment key={i}>{i > 0 && ', '}<span className={partes.guardado >= 0 && i !== partes.guardado ? 'cartao-fora' : undefined}>{v}</span></Fragment>
                ))}]{partes.resto && <> {partes.resto}</>}
              </>
            ) : m.det}
          </p>
          <p className="cartao-autor"><span className="msg-autor">{m.autor}</span> · <time className="msg-hora">{horaCurta(m.em)}</time></p>
        </div>
        <span className="cartao-igual" aria-hidden="true">=</span>
        <span className="cartao-total msg-total">{m.total}</span>
      </div>
    </li>
  );
}

/* O cartão que aparece no clique, antes de o servidor responder. */
function CartaoPendente({ p, estilo }: { p: RolagemPendente; estilo: EstiloDado }) {
  return (
    <li className="cartao-linha cartao-pendente msg-minha" data-estilo={estilo} aria-label="Rolando os dados">
      <div className="cartao">
        <span className="cartao-icone"><IconeEstilo estilo={estilo} /></span>
        <div className="cartao-meio">
          <p className="cartao-titulo">{p.rotulo}</p>
          <p className="cartao-dados">rolando…</p>
        </div>
        <span className="cartao-igual" aria-hidden="true">=</span>
        <span className="cartao-total"><NumeroGirando teto={p.lados} /></span>
      </div>
    </li>
  );
}

/* Estilos prontos do cartão. Ficam salvos neste navegador e valem para as rolagens da própria pessoa. */
function EscolhaEstilo({ estilo, setEstilo }: { estilo: EstiloDado; setEstilo: (e: EstiloDado) => void }) {
  return (
    <div className="estilos" role="radiogroup" aria-label="Estilo dos dados">
      {ESTILOS_DADO.map(e => (
        <button key={e.id} type="button" role="radio" aria-checked={estilo === e.id} className="estilo-opcao" data-estilo={e.id} onClick={() => setEstilo(e.id)}>
          <span className="cartao-icone"><IconeEstilo estilo={e.id} /></span>
          <span className="estilo-nome">{e.nome}</span>
        </button>
      ))}
    </div>
  );
}

/* Histórico e dados. É usado dentro da janela flutuante da ficha e no painel da campanha. */
export function CorpoChat({ chat, aoRolar }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  const [bonus, setBonus] = useState('0');
  const [estilo] = useEstiloDado();
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
                <CartaoRolagem m={m} nova={corte !== null && m.em > corte} estilo={estilo} />
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
  const [estilo] = useEstiloDado();
  return (
    <section className="chat-popup" role="status" aria-label="Última rolagem" data-estilo={estilo}>
      <button type="button" className="chat-fechar" aria-label="Fechar o resultado da rolagem" onClick={aoFechar}>×</button>
      <ul>
        {pendente
          ? <CartaoPendente key={`pendente-${pendente.id}`} p={pendente} estilo={estilo} />
          : m && <CartaoRolagem key={m.id} m={m} nova estilo={estilo} />}
      </ul>
    </section>
  );
}

/* Painel lateral da ficha: mostra o pop-up ao rolar, abre pela pílula e avisa quando chega rolagem de outra pessoa com ela fechada. */
export function ChatFlutuante({ chat, aoRolar, escopo }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void; escopo: string }) {
  const { aberto, setAberto, mensagens, carregando, destaque, setDestaque, pendente } = chat;
  const [estilo, setEstilo] = useEstiloDado();
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
          <p className="rotulo">Estilo das suas rolagens</p>
          <EscolhaEstilo estilo={estilo} setEstilo={setEstilo} />
        </div>
      )}
      <CorpoChat chat={chat} aoRolar={aoRolar} />
    </section>
  );
}
