'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Paintbrush, Volume2, VolumeX } from 'lucide-react';
import { DADOS, inteiro } from '@/lib/regras';
import type { Mensagem } from '@/lib/tipos';
import { urlBanner } from '@/lib/cliente';
import type { ChatDados, RolagemPendente } from '@/lib/useChat';
import { useEstiloDado, useSomRolagens } from '@/lib/tema';
import { ESTILOS_DADO, estiloDado, temRaio } from '@/lib/estilos';
import { extremoDaRolagem, separarDetalhe, type DetalheSeparado } from '@/lib/extremo';
import { Capitular } from './comuns';
import { IconeDado, coresDoEstilo } from './IconeDado';
import ChamasCritico from './ChamasCritico';
import RaioCritico from './RaioCritico';

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
  useEffect(() => {
    if (!efeito) return;
    const raiz = document.documentElement;
    const classe = efeito.tipo === 'raio' ? 'tremor-raio' : efeito.tipo === 'critico' ? 'tremor-critico' : 'tremor-falha';
    raiz.classList.add(classe);
    let fim: ReturnType<typeof setTimeout> | undefined;
    /* O crítico some quando as chamas acabam (ChamasCritico avisa); a falha tem tempo fixo. */
    if (efeito.tipo === 'falha') fim = setTimeout(() => setEfeito(null), 1400);
    return () => { clearTimeout(fim); raiz.classList.remove(classe); };
  }, [efeito, setEfeito]);
  if (!efeito) return null;
  /* Sem ícone escolhido, o fogo segue a cor do tema do site. */
  const e = estiloDado(meu);
  const cor = e?.cor ?? corDoTema('--secondary', '#8f6bff'), claro = e?.claro ?? corDoTema('--secondary-claro', '#d04dff');
  return createPortal(
    efeito.tipo === 'raio'
      ? <RaioCritico key={efeito.id} aoTerminar={() => setEfeito(null)} />
      : efeito.tipo === 'critico'
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

/* Línguas de fogo subindo do pé do cartão do crítico, na cor do ícone. Posições e ritmos fixos:
   gerar ao acaso faria o fogo pular a cada nova mensagem que chega no chat. */
const LINGUAS = [[2, 0, .9], [12, 180, 1.1], [23, 60, .8], [34, 260, 1.2], [46, 120, 1], [57, 320, .85], [68, 30, 1.15], [79, 220, .95], [90, 140, 1.05]];
function ChamasDoCartao() {
  return (
    <span className="cartao-chamas" aria-hidden="true">
      {LINGUAS.map(([x, atraso, alto]) => (
        <i key={x} style={{ '--x': `${x}%`, '--atraso': `${atraso}ms`, '--alto': alto } as React.CSSProperties} />
      ))}
    </span>
  );
}

/* Eletricidade estática contornando o cartão inteiro: o contorno é redesenhado várias vezes por segundo,
   sempre torto de um jeito diferente, e de vez em quando um arco salta para fora. Desenhar direto no SVG,
   sem estado do React, evita renderizar o chat a cada estalo. */
const RAIO_CANTO = 12;
function pontoNoContorno(s: number, w: number, h: number): [number, number, number, number] {
  /* Percorre o retângulo de cantos redondos e devolve o ponto e a normal para fora. */
  const r = Math.min(RAIO_CANTO, w / 2, h / 2), lw = w - 2 * r, lh = h - 2 * r, arco = Math.PI * r / 2;
  const trechos: [number, (t: number) => [number, number, number, number]][] = [
    [lw, t => [r + t, 0, 0, -1]],
    [arco, t => { const a = -Math.PI / 2 + t / r; return [w - r + Math.cos(a) * r, r + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; }],
    [lh, t => [w, r + t, 1, 0]],
    [arco, t => { const a = t / r; return [w - r + Math.cos(a) * r, h - r + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; }],
    [lw, t => [w - r - t, h, 0, 1]],
    [arco, t => { const a = Math.PI / 2 + t / r; return [r + Math.cos(a) * r, h - r + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; }],
    [lh, t => [0, h - r - t, -1, 0]],
    [arco, t => { const a = Math.PI + t / r; return [r + Math.cos(a) * r, r + Math.sin(a) * r, Math.cos(a), Math.sin(a)]; }],
  ];
  for (const [tam, f] of trechos) { if (s <= tam) return f(s); s -= tam; }
  return [r, 0, 0, -1];
}
function contornoEletrico(w: number, h: number, amplitude: number) {
  const r = Math.min(RAIO_CANTO, w / 2, h / 2), total = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  const pts: string[] = [];
  for (let s = 0; s < total; s += 5 + Math.random() * 5) {
    const [x, y, nx, ny] = pontoNoContorno(s, w, h);
    /* Quase sempre perto da borda; às vezes um pico maior, que é o estalo da estática. */
    const d = (Math.random() - .35) * amplitude * (Math.random() < .08 ? 3 : 1);
    pts.push(`${(x + nx * d).toFixed(1)},${(y + ny * d).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
function arcoSolto(w: number, h: number) {
  const r = Math.min(RAIO_CANTO, w / 2, h / 2), total = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  const [x, y, nx, ny] = pontoNoContorno(Math.random() * total, w, h);
  const tx = -ny, ty = nx, passos = 4, pts: string[] = [];
  for (let i = 0; i <= passos; i++) {
    const out = Math.sin(Math.PI * i / passos) * (6 + Math.random() * 6), lado = (i - passos / 2) * 7;
    pts.push(`${(x + nx * out + tx * lado + (Math.random() - .5) * 3).toFixed(1)},${(y + ny * out + ty * lado + (Math.random() - .5) * 3).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}
function EstaticaDoCartao() {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svg.current, cartao = el?.parentElement;
    if (!el || !cartao) return;
    const [contorno, fino, arco] = Array.from(el.querySelectorAll('path'));
    let w = cartao.clientWidth, h = cartao.clientHeight;
    const desenhar = () => {
      el.setAttribute('viewBox', `0 0 ${w} ${h}`);
      contorno!.setAttribute('d', contornoEletrico(w, h, 6));
      fino!.setAttribute('d', contornoEletrico(w, h, 4));
      arco!.setAttribute('d', Math.random() < .6 ? `${arcoSolto(w, h)}${Math.random() < .5 ? arcoSolto(w, h) : ''}` : '');
    };
    const medida = new ResizeObserver(() => { w = cartao.clientWidth; h = cartao.clientHeight; desenhar(); });
    medida.observe(cartao);
    desenhar();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => medida.disconnect();
    const estalo = setInterval(desenhar, 70);
    return () => { clearInterval(estalo); medida.disconnect(); };
  }, []);
  return (
    <svg ref={svg} className="cartao-estatica" aria-hidden="true" preserveAspectRatio="none" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path className="estatica-contorno" />
      <path className="estatica-fina" />
      <path className="estatica-arco" />
    </svg>
  );
}

/* O cartão leva o ícone e as cores de quem rolou, para todos que o veem: o ícone é a assinatura do jogador. */
function CartaoRolagem({ m, nova }: { m: Mensagem; nova: boolean }) {
  const banner = m.bannerV ? { '--banner': `url("${urlBanner(m.id, m.bannerV)}")` } as React.CSSProperties : undefined;
  const partes = separarDetalhe(m.det);
  const extremo = extremoDaRolagem(m.det);
  const raio = extremo === 'critico' && temRaio(m.estilo, m.combate);
  return (
    <li className={`cartao-linha msg${m.minha ? ' msg-minha' : ''}${nova ? ' msg-nova' : ''}`} data-estilo={m.estilo ?? 'tema'} style={coresDoEstilo(m.estilo)} data-extremo={extremo ?? undefined} data-raio={raio || undefined}>
      {!m.minha && <Capitular className="msg-foto" nome={m.autor} fichaId={m.fichaId ?? undefined} fotoV={m.fotoV} />}
      <div className={`cartao msg-balao${m.dano ? ' cartao-duplo' : ''}${banner ? ' msg-com-banner' : ''}`} style={banner}>
        {extremo === 'critico' && !raio && <ChamasDoCartao />}
        {raio && <EstaticaDoCartao />}
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
      {/* Com dano, o mesmo molde do resultado: sem ele, o dano caía para a linha de baixo enquanto rolava. */}
      <div className={`cartao${p.comDano ? ' cartao-duplo' : ''}`}>
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
  const { meu, ocupados, exclusivos, carregado, escolher, atualizar } = useEstiloDado();
  /* A lista de ocupados muda quando outras pessoas escolhem: abrir o painel busca a versão nova. */
  useEffect(() => { void atualizar(); }, [atualizar]);
  /* Exclusivo de outra conta nem aparece: não é um ícone ocupado, é um que esta conta nunca pode ter. */
  const opcoes = [{ id: null, nome: 'D20 do tema (de todos)' }, ...ESTILOS_DADO.filter(e => !e.exclusivo || exclusivos.includes(e.id))];
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

  const primeiraEm = mensagens[0]?.em;
  const ultimaId = pendente && !pendente.popup ? `pendente-${pendente.id}` : mensagens.at(-1)?.id;
  const alturaAntes = useRef(0);
  const primeiraEmAntes = useRef<number | undefined>(undefined);
  const ultimaAntes = useRef<string | undefined>(undefined);
  const colado = useRef(true);

  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    /* Só é "carregou antigas" quando entrou mensagem mais velha no topo. A página do servidor traz as 50
       mais recentes: depois de uma rolagem nova, a mais velha sai do topo, e tratar isso como carga de
       antigas jogava a lista para cima. */
    const carregouAntigas = primeiraEmAntes.current !== undefined && primeiraEm !== undefined
      && primeiraEm < primeiraEmAntes.current && ultimaId === ultimaAntes.current;
    if (carregouAntigas) {
      /* Mantém a pessoa olhando para o mesmo ponto. */
      el.scrollTop += el.scrollHeight - alturaAntes.current;
    } else if (colado.current || (ultimaId !== ultimaAntes.current && (mensagens.at(-1)?.minha || pendente))) {
      /* Quem está no fim continua no fim, mesmo quando a lista muda em cima. */
      el.scrollTop = el.scrollHeight;
      colado.current = true;
    }
    alturaAntes.current = el.scrollHeight;
    primeiraEmAntes.current = primeiraEm;
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
  const [som, setSom] = useSomRolagens();
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
            {som ? 'Sons das rolagens: ligados' : 'Sons das rolagens: desligados'}
          </button>
        </div>
      )}
      <CorpoChat chat={chat} aoRolar={aoRolar} />
    </section>
    </>
  );
}
