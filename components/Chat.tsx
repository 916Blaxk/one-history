'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Droplet, FlaskConical, Flame, Moon, Paintbrush, Snowflake } from 'lucide-react';
import { DADOS, inteiro } from '@/lib/regras';
import type { Mensagem } from '@/lib/tipos';
import { urlBanner } from '@/lib/cliente';
import type { ChatDados, RolagemPendente } from '@/lib/useChat';
import { ESTILOS_DADO, useEstiloDado, type EstiloDado } from '@/lib/tema';
import { extremoDaRolagem, separarDetalhe, type DetalheSeparado } from '@/lib/extremo';
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

/* ---------- Rolagem extrema ----------
   Máximo no dado: um clarão negro toma a tela (raios pretos com brilho vermelho, a tela inverte
   e treme). 1 no dado: a tela perde a cor por um instante. Só na rolagem da própria pessoa. */
interface Raio { pontos: string; atraso: number }
function gerarRaios(): Raio[] {
  const raios: Raio[] = [];
  const total = 11;
  for (let i = 0; i < total; i++) {
    const angulo = (i / total) * Math.PI * 2 + (Math.random() - .5) * .5;
    const pontos: string[] = [];
    let r = 6 + Math.random() * 6;
    while (r < 160) {
      /* Desvio para o lado do raio: é o zigue-zague que faz parecer um relâmpago. */
      const desvio = (Math.random() - .5) * 18;
      const x = Math.cos(angulo) * r - Math.sin(angulo) * desvio;
      const y = Math.sin(angulo) * r + Math.cos(angulo) * desvio;
      pontos.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      r += 8 + Math.random() * 14;
    }
    raios.push({ pontos: pontos.join(' '), atraso: Math.round(Math.random() * 120) });
  }
  return raios;
}

function ClaraoNegro() {
  const [raios] = useState(gerarRaios);
  return (
    <div className="clarao-negro" aria-hidden="true">
      <div className="cn-inverte" />
      <div className="cn-escuro" />
      <div className="cn-vermelho" />
      <svg className="cn-raios" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice">
        {raios.map((r, i) => (
          <g key={i} style={{ '--atraso': `${r.atraso}ms` } as React.CSSProperties}>
            <polyline className="cn-raio-brilho" points={r.pontos} pathLength={1} />
            <polyline className="cn-raio-nucleo" points={r.pontos} pathLength={1} />
          </g>
        ))}
      </svg>
      <div className="cn-faiscas">
        {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--a': `${i * 22.5 + 7}deg`, '--d': `${(i % 4) * 40}ms` } as React.CSSProperties} />)}
      </div>
      <p className="cn-texto"><span>Clarão</span><span>negro</span></p>
    </div>
  );
}

function EfeitoTela({ chat }: { chat: ChatDados }) {
  const { efeito, setEfeito } = chat;
  useEffect(() => {
    if (!efeito) return;
    const raiz = document.documentElement;
    const classe = efeito.tipo === 'critico' ? 'tremor-critico' : 'tremor-falha';
    raiz.classList.add(classe);
    const fim = setTimeout(() => setEfeito(null), efeito.tipo === 'critico' ? 1500 : 900);
    return () => { clearTimeout(fim); raiz.classList.remove(classe); };
  }, [efeito, setEfeito]);
  if (!efeito) return null;
  return createPortal(
    efeito.tipo === 'critico' ? <ClaraoNegro key={efeito.id} /> : <div key={efeito.id} className="efeito-falha" aria-hidden="true" />,
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

function CartaoRolagem({ m, nova, estilo }: { m: Mensagem; nova: boolean; estilo: EstiloDado }) {
  const banner = m.bannerV ? { '--banner': `url("${urlBanner(m.id, m.bannerV)}")` } as React.CSSProperties : undefined;
  const partes = separarDetalhe(m.det);
  const extremo = extremoDaRolagem(m.det);
  const meuEstilo: EstiloDado = m.minha ? estilo : 'tema';
  return (
    <li className={`cartao-linha msg${m.minha ? ' msg-minha' : ''}${nova ? ' msg-nova' : ''}`} data-estilo={meuEstilo} data-extremo={extremo ?? undefined}>
      {!m.minha && <Capitular className="msg-foto" nome={m.autor} fichaId={m.fichaId ?? undefined} fotoV={m.fotoV} />}
      <div className={`cartao msg-balao${m.dano ? ' cartao-duplo' : ''}${banner ? ' msg-com-banner' : ''}`} style={banner}>
        <span className="cartao-icone"><IconeEstilo estilo={meuEstilo} /></span>
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
function CartaoPendente({ p, estilo }: { p: RolagemPendente; estilo: EstiloDado }) {
  return (
    <li className="cartao-linha cartao-pendente msg-minha" data-estilo={estilo} aria-label="Rolando os dados">
      <div className="cartao">
        <span className="cartao-icone"><IconeEstilo estilo={estilo} /></span>
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
          <p className="rotulo">Estilo das suas rolagens</p>
          <EscolhaEstilo estilo={estilo} setEstilo={setEstilo} />
        </div>
      )}
      <CorpoChat chat={chat} aoRolar={aoRolar} />
    </section>
    </>
  );
}
