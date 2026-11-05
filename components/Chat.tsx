'use client';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DADOS, inteiro } from '@/lib/regras';
import type { Mensagem } from '@/lib/tipos';
import type { ChatDados } from '@/lib/useChat';
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

/* O número gira por um instante antes de parar no resultado. Só na rolagem que a própria pessoa acabou de fazer. */
function TotalGirando({ total }: { total: number }) {
  const [mostrado, setMostrado] = useState<number | null>(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : 1);
  useEffect(() => {
    if (mostrado === null) return;
    const teto = Math.max(20, total);
    const giro = setInterval(() => setMostrado(Math.floor(Math.random() * teto) + 1), 55);
    const fim = setTimeout(() => { clearInterval(giro); setMostrado(null); }, 480);
    return () => { clearInterval(giro); clearTimeout(fim); };
    // Só gira uma vez, ao aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (mostrado === null) return <>{total}</>;
  return <><span aria-hidden="true">{mostrado}</span><span className="so-leitor">{total}</span></>;
}

function BalaoRolagem({ m, nova }: { m: Mensagem; nova: boolean }) {
  return (
    <li className={`msg${m.minha ? ' msg-minha' : ''}${nova ? ' msg-nova' : ''}`}>
      {!m.minha && <Capitular className="msg-foto" nome={m.autor} fichaId={m.fichaId ?? undefined} fotoV={m.fotoV} />}
      <div className="msg-balao">
        <p className="msg-topo"><span className="msg-autor">{m.autor}</span> <time className="msg-hora">{horaCurta(m.em)}</time></p>
        <div className="msg-corpo">
          <span className="msg-total">{nova && m.minha ? <TotalGirando total={m.total} /> : m.total}</span>
          <span className="msg-texto">
            {m.rotulo && <span className="msg-rotulo">{m.rotulo}</span>}
            <span className="msg-det">{m.det}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

/* Histórico e dados. É usado dentro da janela flutuante da ficha e no painel da campanha. */
export function CorpoChat({ chat, aoRolar }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  const [bonus, setBonus] = useState('0');
  const { mensagens, carregando } = chat;

  /* Mensagens de antes de abrir o chat entram paradas. Só as que chegam depois têm animação. */
  const corte = useRef<number | null>(null);
  if (corte.current === null && !carregando) corte.current = mensagens.at(-1)?.em ?? 0;

  const primeiraId = mensagens[0]?.id;
  const ultimaId = mensagens.at(-1)?.id;
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
    } else if (ultimaId !== ultimaAntes.current && (colado.current || mensagens.at(-1)?.minha)) {
      el.scrollTop = el.scrollHeight;
      colado.current = true;
    }
    alturaAntes.current = el.scrollHeight;
    primeiraAntes.current = primeiraId;
    ultimaAntes.current = ultimaId;
  });

  let diaAnterior = '';
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
        {mensagens.length === 0 && (
          <p className="chat-vazio">{carregando ? 'Abrindo o histórico…' : 'Nenhuma rolagem ainda. Escolha um dado abaixo ou clique em d20 ao lado de um atributo da ficha.'}</p>
        )}
        <ul role="log" aria-live="polite" aria-label="Histórico de rolagens">
          {mensagens.map(m => {
            const dia = nomeDoDia(m.em);
            const separador = dia !== diaAnterior;
            diaAnterior = dia;
            return (
              <Fragment key={m.id}>
                {separador && <li className="chat-dia"><span>{dia}</span></li>}
                <BalaoRolagem m={m} nova={corte.current !== null && m.em > corte.current} />
              </Fragment>
            );
          })}
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

/* Janela flutuante da ficha: abre sozinha ao rolar e avisa quando chega rolagem de outra pessoa com ela fechada. */
export function ChatFlutuante({ chat, aoRolar, escopo }: { chat: ChatDados; aoRolar: (lados: number, bonus: number) => void; escopo: string }) {
  const { aberto, setAberto, mensagens, carregando } = chat;
  const visto = useRef<number | null>(null);
  const ultima = mensagens.at(-1)?.em ?? 0;
  if (visto.current === null && !carregando) visto.current = ultima;
  if (aberto && visto.current !== null) visto.current = Math.max(visto.current, ultima);
  const corteVisto = visto.current ?? Infinity;
  const naoLidas = aberto ? 0 : mensagens.filter(m => !m.minha && m.em > corteVisto).length;

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, setAberto]);

  if (!aberto) {
    return (
      <button type="button" className="chat-pilula" onClick={() => setAberto(true)}>
        Chat de dados
        {naoLidas > 0 && <span className="chat-contagem" aria-label={`${naoLidas} ${naoLidas === 1 ? 'rolagem nova' : 'rolagens novas'}`}>{naoLidas}</span>}
      </button>
    );
  }
  return (
    <section className="chat-flutuante" aria-label="Chat de dados">
      <header className="chat-cab">
        <div>
          <h2 className="titulo-grupo">Chat de dados</h2>
          <p className="chat-escopo">{escopo}</p>
        </div>
        <button type="button" className="chat-fechar" aria-label="Fechar o chat de dados" onClick={() => setAberto(false)}>×</button>
      </header>
      <CorpoChat chat={chat} aoRolar={aoRolar} />
    </section>
  );
}
