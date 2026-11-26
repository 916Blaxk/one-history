'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Axe, Camera, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Crop, Droplets, Feather, Flame, HeartPulse, LayoutGrid, Mountain, Sword, Trash2, Wind, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import AjusteFoto, { arquivoDeDataUrl, fotoDaTela } from '@/components/AjusteFoto';
import Armas from '@/components/Armas';
import { ChatFlutuante } from '@/components/Chat';
import { BotaoConfirmar, CampoNumero, Capitular } from '@/components/comuns';
import ElementosCriados from '@/components/ElementosCriados';
import GraficoAtributos from '@/components/GraficoAtributos';
import Habilidades from '@/components/Habilidades';
import Magias from '@/components/Magias';
import TabelaPericias from '@/components/TabelaPericias';
import { api, dataCurta, mensagem, pct } from '@/lib/cliente';
import { MOLDURA_FOTO, type Enquadramento } from '@/lib/enquadramento';
import * as R from '@/lib/regras';
import { expressaoDaRolagem } from '@/lib/resumoFicha';
import type { Ficha, Mensagem } from '@/lib/tipos';
import type { useChat } from '@/lib/useChat';
import type { useFichaEditavel } from '@/lib/useFicha';

/* Na ordem de `NUCLEOS`: o núcleo clareia de vermelho até branco conforme o personagem avança. */
const COR_DO_NUCLEO = ['#7a1414', '#b3201c', '#e5443a', '#b34d0f', '#e8771c', '#f6a24b', '#a8860a', '#e3bd1f', '#f7e35d', '#8e99a8', '#c3ccd6', '#e9eef2', '#ffffff'];

const ICONES: Record<string, LucideIcon> = { fogo: Flame, agua: Droplets, vento: Wind, terra: Mountain, cura: HeartPulse, leves: Feather, medias: Sword, pesadas: Axe };
/* Só para desenhar a barra: valores maiores continuam valendo. */
const TETO_DA_BARRA = 20;

/* O menu do celular, como no C.R.I.S: cada parte da ficha numa tela. Da Perícias em diante, são as abas do computador. */
const PARTES_MENU = [
  ['info', 'Informações'], ['cena', 'Cena'], ['atributos', 'Atributos'], ['pericias', 'Perícias'],
  ['armas', 'Armas'], ['magias', 'Habilidades'], ['habilidades', 'Talentos'], ['inventario', 'Inventário'], ['notas', 'Notas'],
] as const;
type ParteMenu = typeof PARTES_MENU[number][0];
type Aba = 'armas' | 'pericias' | 'magias' | 'habilidades' | 'inventario' | 'notas';
const ABAS: readonly ParteMenu[] = ['armas', 'pericias', 'magias', 'habilidades', 'inventario', 'notas'];

const CAMPOS_TEXTO = [
  ['nome', 'Nome'], ['player', 'Player'], ['raca', 'Raça'], ['idade', 'Idade'], ['estilo', 'Estilo de magia'],
] as const;

export default function EditorFicha({ f, ed, chat }: {
  f: Ficha; ed: ReturnType<typeof useFichaEditavel>; chat: ReturnType<typeof useChat>;
}) {
  const router = useRouter();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [fotoEscolhida, setFotoEscolhida] = useState<{ arquivo: File; original?: string; ajuste?: Enquadramento | null } | null>(null);
  const [editandoLimites, setEditandoLimites] = useState(false);
  const [aba, setAba] = useState<Aba>('armas');
  /* Só o celular usa: no computador, as três colunas ficam sempre à vista. */
  const [secao, setSecao] = useState<'info' | 'cena' | 'atributos' | 'abas'>('cena');
  const [menuAberto, setMenuAberto] = useState(false);
  const parteAtual: ParteMenu = secao === 'abas' ? aba : secao;
  function irPara(p: ParteMenu) {
    if (ABAS.includes(p)) { setAba(p as Aba); setSecao('abas'); } else setSecao(p as Exclude<ParteMenu, Aba>);
    setMenuAberto(false);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuAberto]);
  const url = `/api/fichas/${f.id}`;
  const vm = R.vidaMax(f), mm = R.manaMax(f), e = R.estagio(f.fadiga), perdido = e.min === 100, perda = R.perdaDeCena(f);
  const campanha = f.contexto.campanha;
  const voltar = f.contexto.souMestre && campanha ? { href: `/campanhas/${campanha.id}`, txt: `Voltar para ${campanha.nome}` } : { href: '/fichas', txt: 'Minhas fichas' };

  function mudarComMaximos(mudar: (c: Ficha) => void, patch: (c: Ficha) => Record<string, unknown>) {
    const c = structuredClone(f);
    mudar(c);
    R.acompanharMaximos(c, vm, mm);
    ed.definir(c, { ...patch(c), vidaAtual: c.vidaAtual, manaAtual: c.manaAtual });
  }
  const mudarAttr = (g: R.Grupo, k: string, v: unknown) =>
    mudarComMaximos(c => { c[g][k] = R.inteiro(v, 0, 999); }, c => ({ [g]: { [k]: c[g][k] } }));
  const mudarAjuste = (chave: keyof R.AjustesMestre, v: unknown) =>
    mudarComMaximos(c => { c.ajustes[chave] = R.inteiro(v, -9999, 9999); }, c => ({ ajustes: { [chave]: c.ajustes[chave] } }));
  /* A pessoa digita o total, e a diferença para a fórmula vira o ajuste: subir vitalidade continua somando. */
  const mudarVidaMaxima = (v: unknown) => mudarAjuste('vida', R.inteiro(v, 0, 99999) - (vm - f.ajustes.vida));
  const elementosDaFicha = R.elementosDaFicha(f);
  function adicionarElemento(k: string) {
    const elementosAtivos = [...f.elementosAtivos, k];
    ed.definir({ ...f, elementosAtivos }, { elementosAtivos });
  }
  function removerElemento(k: string) {
    const elementosAtivos = f.elementosAtivos.filter(o => o !== k);
    ed.definir({ ...f, elementosAtivos, elementos: { ...f.elementos, [k]: 0 } }, { elementosAtivos, elementos: { [k]: 0 } });
  }
  const mudarLimite = (chave: string, v: string) => {
    const limites = { ...f.limites };
    if (v === '') delete limites[chave];
    else limites[chave] = R.inteiro(v, 0, 999);
    ed.definir({ ...f, limites }, { limites: { [chave]: limites[chave] ?? null } });
  };
  const mudarVital = (chave: 'vidaAtual' | 'manaAtual', v: unknown) => {
    const valor = R.inteiro(v, 0, chave === 'vidaAtual' ? vm : mm);
    ed.definir({ ...f, [chave]: valor }, { [chave]: valor });
  };
  const mudarFadiga = (v: unknown) => {
    const fadiga = R.inteiro(v, 0, 100);
    ed.definir({ ...f, fadiga }, { fadiga });
  };
  function conjurar(m: R.Magia) {
    const custo = R.custoMagia(f, m), nome = m.nome || 'Magia sem nome';
    if (custo > f.manaAtual) { toast.error(`Mana insuficiente: ${nome} custa ${custo} e a ficha tem ${f.manaAtual}.`); return; }
    mudarVital('manaAtual', f.manaAtual - custo);
    toast(`${nome}: −${custo} de mana`);
    /* Acerto pela perícia da habilidade e dano rolam juntos no chat de dados; `rolar` salva a mana antes. */
    const temPericia = R.periciaDaHabilidade(m.pericias) !== null, temDano = m.dano.trim() !== '';
    if (temPericia || temDano) rolar({ magia: m.id }, nome, temPericia && temDano);
  }

  /* `rotulo` só aparece no cartão enquanto o número gira; o nome final vem do servidor.
     `comDano`: o cartão já abre com dois números, acerto e dano. */
  function rolar(corpo: { atributo?: string; magia?: string; lados?: number; bonus?: number }, rotulo?: string, comDano = false) {
    /* O cartão aparece no clique; com o chat aberto, o resultado já aparece nele. */
    void chat.rolar({ rotulo: rotulo ?? (corpo.lados ? `d${corpo.lados}` : 'Rolando…'), lados: corpo.lados, popup: !chat.aberto, comDano }, async () => {
      /* Atributo, arma e magia usam o que está guardado no servidor (e a magia, a mana já gasta):
         salva antes o que ainda está pendente. Dado avulso não depende da ficha, então não espera. */
      if (!corpo.lados) await ed.salvarAgora();
      return (await api<{ rolagem: Mensagem }>('POST', `${url}/rolar`, corpo)).rolagem;
    });
  }
  async function encerrarCena() {
    try {
      await ed.salvarAgora();
      const r = await api<{ ficha: Ficha; mensagem: string }>('POST', `${url}/encerrar-cena`);
      ed.setFicha(r.ficha);
      toast(r.mensagem);
    } catch (err) { toast.error(mensagem(err)); }
  }
  async function reajustarFoto() {
    try {
      const { foto, ajuste } = await api<{ foto: string; ajuste: Enquadramento | null }>('GET', `${url}/foto-original`);
      /* Foto antiga não tem enquadramento guardado: a própria foto vira o ponto de partida. */
      setFotoEscolhida({ arquivo: arquivoDeDataUrl(foto, 'foto'), original: foto, ajuste });
    } catch (err) { toast.error(mensagem(err)); }
  }
  async function enviarFoto(foto: string, reajuste: { fotoOriginal: string | null; fotoAjuste: Enquadramento } | Record<string, never> = {}) {
    try {
      ed.setStatus('Salvando…');
      const r = await api<{ ficha: Ficha }>('PATCH', url, { foto, ...reajuste });
      ed.setFicha(a => a && { ...a, fotoV: r.ficha.fotoV, atualizado: r.ficha.atualizado });
      ed.setStatus('Salvo');
    } catch (err) { ed.setStatus('Não salvo'); toast.error(mensagem(err)); }
  }
  async function duplicar() {
    try {
      await ed.salvarAgora();
      const { contexto: _c, id: _i, donoId: _d, campanhaId: _ca, registro: _r, fotoV: _v, atualizado: _a, ...dados } = f;
      const { ficha } = await api<{ ficha: Ficha }>('POST', '/api/fichas', { dados: { ...dados, nome: `${f.nome || 'Sem nome'} (cópia)` } });
      toast.success('Ficha duplicada. Você está editando a cópia.');
      router.push(`/fichas/${ficha.id}`);
    } catch (err) { toast.error(mensagem(err)); }
  }
  async function apagar() {
    try {
      await api('DELETE', url);
      toast.success(`Ficha de ${f.nome || 'Sem nome'} apagada.`);
      router.push('/fichas');
    } catch (err) { toast.error(mensagem(err)); }
  }

  const linhaAttr = (g: R.Grupo, item: readonly string[], cor?: boolean) => {
    const [k, rotulo, desc] = item;
    const idCampo = `a-${g}-${k}`;
    const chave = R.chaveLimite(g, k), limite = f.limites[chave];
    const Icone = ICONES[k];
    const vantagem = R.vantagemDaRolagem(f, g, k), soma = R.somaDaRolagem(f, g, k), ehAtributo = g === 'corpo' || g === 'mente';
    const dicaRolagem = `Rolar ${vantagem ? `${vantagem + 1}d20, fica o maior` : 'd20'}${soma ? `, + ${soma}` : ''}`;
    return (
      <div className={`attr${cor ? ` c-${k}` : ''}`} data-grupo={g} data-ativo={f[g][k] > 0} data-acima={limite !== undefined && f[g][k] > limite} key={k}>
        {/* A descrição vira dica: na linha, ela empurrava a ficha e repetia o que o nome já diz. */}
        <label htmlFor={idCampo} title={desc || undefined}>{Icone && <Icone className="attr-icone" aria-hidden="true" />}{rotulo}{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
        <div className="passo">
          <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] - 1)}>−</button>
          <CampoNumero id={idCampo} min={0} valor={f[g][k]} aoMudar={v => mudarAttr(g, k, v)} />
          <button type="button" aria-label={`Aumentar ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] + 1)}>+</button>
        </div>
        <button type="button" className="rolar" title={dicaRolagem} aria-label={ehAtributo ? `Rolar d20 de ${rotulo}` : `Rolar d20 mais ${rotulo}`} onClick={() => rolar({ atributo: `${g}.${k}` })}>d20</button>
        {cor && <span className="attr-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, f[g][k] / TETO_DA_BARRA * 100)}%` }} /></span>}
        {cor && <div className="elemento-remover"><BotaoConfirmar className="btn btn-pequeno" rotulo={`Remover ${rotulo}`} confirmar="Confirmar: remover" aoConfirmar={() => removerElemento(k)} /></div>}
        {editandoLimites && (
          <label className="campo-limite">
            Limite de {rotulo}
            <input type="number" inputMode="numeric" min={0} max={999} placeholder="Sem limite" value={limite ?? ''} onChange={ev => mudarLimite(chave, ev.target.value)} />
          </label>
        )}
      </div>
    );
  };
  /* Vida e mana como no C.R.I.S: a barra é o próprio controle, com as setas dentro e o número no meio. */
  const PASSOS = [[-5, ChevronsLeft], [-1, ChevronLeft], [1, ChevronRight], [5, ChevronsRight]] as const;
  const medidor = (chave: 'vidaAtual' | 'manaAtual', rotulo: string, classe: string, atual: number, max: number, formula: string, extra?: React.ReactNode) => {
    const passo = ([d, Icone]: typeof PASSOS[number]) => {
      const nome = `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
      return <button type="button" key={d} aria-label={nome} title={nome} onClick={() => mudarVital(chave, atual + d)}><Icone aria-hidden="true" /></button>;
    };
    return (
      <div className={`medidor ${classe}`}>
        <label className="medidor-rot" htmlFor={`v-${chave}`}>{rotulo}</label>
        <div className="medidor-barra">
          <i className="medidor-cheio" style={{ width: `${pct(atual, max)}%` }} aria-hidden="true" />
          {PASSOS.slice(0, 2).map(passo)}
          <span className="medidor-num">
            <CampoNumero id={`v-${chave}`} min={0} aoVivo valor={atual} aoMudar={v => mudarVital(chave, v)} />
            <span aria-hidden="true">/</span>
            {chave === 'vidaAtual' ? <CampoNumero id="v-vidaMaxima" aria-label="Vida máxima" min={0} valor={max} aoMudar={mudarVidaMaxima} /> : <b>{max}</b>}
          </span>
          {PASSOS.slice(2).map(passo)}
        </div>
        <p className="formula">{formula}</p>
        {extra}
      </div>
    );
  };

  const base = R.manaBase(f);
  const bonus = R.bonusNucleo(f.nucleo), ppUsados = R.ppGastos(f), ppMax = R.ppTotal(f), apUsados = R.apGastos(f), apMax = R.apTotal(f);
  const parcelaAjuste = (v: number) => (v ? ` ${v > 0 ? '+' : '−'} ajuste ${Math.abs(v)}` : '');
  const campoBonus = (chave: keyof R.AjustesMestre, nome: string) => (
    <label className="perda-perm" htmlFor={`c-ajuste-${chave}`}>
      Bônus em {nome}
      <CampoNumero id={`c-ajuste-${chave}`} valor={f.ajustes[chave]} aoMudar={v => mudarAjuste(chave, v)} />
    </label>
  );
  /* Bônus e limites são correções do mestre, raras durante o jogo: só aparecem no modo de ajustes. */
  const soAjustes = (no: React.ReactNode) => (editandoLimites ? no : null);
  const abas = [
    ['armas', `Armas (${f.arsenal.length})`], ['pericias', 'Perícias'], ['magias', `Habilidades (${f.magias.length})`], ['habilidades', `Talentos (${f.habilidades.length})`],
    ['inventario', 'Inventário'], ['notas', 'Notas'],
  ] as const;

  return (
    <article className="ficha" data-estagio={e.min} data-secao={secao}>
      <div className="veu" data-estagio={e.min} aria-hidden="true" />
      <div className="ficha-barra">
        <Link className="btn" href={voltar.href}>← {voltar.txt}</Link>
        <span className="salvo" role="status">{ed.status}</span>
        {campanha && !f.contexto.souMestre && <Link className="btn" href={`/campanhas/${campanha.id}`}>Campanha: {campanha.nome}</Link>}
        {f.contexto.souMestre && !f.contexto.souDono && <span className="selo">Ficha de {f.contexto.donoNome}</span>}
        <span className="espaco" />
        <button type="button" className="btn" aria-pressed={editandoLimites} onClick={() => setEditandoLimites(a => !a)}>{editandoLimites ? 'Concluir ajustes' : 'Ajustes e limites'}</button>
        {f.contexto.souDono && <button type="button" className="btn" onClick={duplicar}>Duplicar</button>}
        {f.contexto.souDono && <BotaoConfirmar rotulo="Apagar" confirmar="Confirmar: apagar para sempre" aoConfirmar={apagar} />}
      </div>
      <header className="placa">
        <div className="bloco-foto">
          {perdido ? <span className="capitular retrato">???</span> : <Capitular className="retrato" nome={f.nome} fichaId={f.id} fotoV={f.fotoV} />}
          <div className="foto-botoes">
            {/* No computador ficam só os ícones, sobre a borda do retrato: o nome continua para o leitor de tela e na dica. */}
            <button type="button" className="btn" title="Trocar foto" onClick={() => entradaFoto.current?.click()}><Camera aria-hidden="true" /><span className="foto-rotulo">Trocar foto</span></button>
            {f.fotoV > 0 && <button type="button" className="btn" title="Ajustar" onClick={reajustarFoto}><Crop aria-hidden="true" /><span className="foto-rotulo">Ajustar</span></button>}
            {f.fotoV > 0 && <button type="button" className="btn" title="Remover" onClick={() => enviarFoto('')}><Trash2 aria-hidden="true" /><span className="foto-rotulo">Remover</span></button>}
          </div>
          <input ref={entradaFoto} id="foto-arquivo" type="file" accept="image/*" hidden onChange={ev => {
            const a = ev.target.files?.[0];
            ev.target.value = '';
            if (a) setFotoEscolhida({ arquivo: a });
          }} />
          {fotoEscolhida && (
            <AjusteFoto
              key={`${fotoEscolhida.arquivo.name}-${fotoEscolhida.arquivo.lastModified}`}
              arquivo={fotoEscolhida.arquivo}
              titulo="Ajustar a foto"
              moldura={MOLDURA_FOTO}
              comOriginal={!fotoEscolhida.original}
              salvo={fotoEscolhida.ajuste}
              aoCancelar={() => setFotoEscolhida(null)}
              aoFalhar={() => { setFotoEscolhida(null); toast.error('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.'); }}
              aoSalvar={(tela, { ajuste, original }) => {
                const foto = fotoDaTela(tela);
                /* Ao reajustar, mantém o original que já existe: recomprimir a cada ajuste iria piorando a imagem. */
                void enviarFoto(foto, { fotoOriginal: fotoEscolhida.original ?? original, fotoAjuste: ajuste });
                setFotoEscolhida(null);
              }}
            />
          )}
        </div>
        <div className="placa-texto">
          <h1 className="placa-nome">{perdido ? '???' : f.nome || 'Sem nome'}</h1>
          {/* Os dados de quem é o personagem ficam no cabeçalho, em linha, como numa ficha de papel. */}
          <div className="placa-campos" data-parte="info">
            {CAMPOS_TEXTO.map(([k, rotulo]) => (
              <div className={`campo-linha campo-${k}`} key={k}>
                <label htmlFor={`c-${k}`}>{rotulo}</label>
                <input id={`c-${k}`} type="text" value={f[k]} onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
              </div>
            ))}
          </div>
        </div>
        <svg className="fenda" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,62 90,48 170,71 260,38 330,55 430,20 490,64 590,44 650,78 760,30 840,58 920,36 1000,70" />
          <polyline points="430,20 462,0" />
          <polyline points="650,78 690,100" />
        </svg>
      </header>

      <div className="ficha-grade">
        <aside className="col-cena" data-parte="cena" aria-label="Em cena">
          {medidor('vidaAtual', 'Vida', 'cor-vida', f.vidaAtual, vm, `15 + vitalidade ${f.corpo.vitalidade} × 2${parcelaAjuste(f.ajustes.vida)} = ${vm}`, soAjustes(campoBonus('vida', 'vida')))}
          {medidor('manaAtual', 'Mana', 'cor-mana', f.manaAtual, mm,
            `30 + determinação ${f.mente.onipotencia} × ${R.MULTIPLICADOR_MANA}${bonus.mana ? ` + núcleo ${bonus.mana}` : ''}${parcelaAjuste(f.ajustes.mana)} = ${base}${f.manaPerdida ? `, menos ${f.manaPerdida} perdida = ${mm}` : ''}`,
            <>
              {soAjustes(campoBonus('mana', 'mana'))}
              {/* A perda vem do fim de cena. O campo só aparece quando há perda, ou para corrigir no modo de ajustes. */}
              {(f.manaPerdida > 0 || editandoLimites) && (
                <label className="perda-perm" htmlFor="c-mana-perdida">
                  Mana total perdida para sempre
                  <CampoNumero id="c-mana-perdida" min={0} valor={f.manaPerdida} aoMudar={v => mudarComMaximos(c => { c.manaPerdida = R.inteiro(v, 0, 99999); }, c => ({ manaPerdida: c.manaPerdida }))} />
                </label>
              )}
            </>)}

          <div className="fadiga-bloco">
            <div className="fadiga-topo">
              <label className="medidor-rot" htmlFor="v-fadiga">Fadiga mental</label>
              <span className="fadiga-num"><CampoNumero id="v-fadiga" min={0} max={100} aoVivo valor={f.fadiga} aoMudar={mudarFadiga} />%</span>
            </div>
            <input id="r-fadiga" type="range" min={0} max={100} step={1} value={f.fadiga} aria-label="Fadiga mental em porcentagem" onChange={ev => mudarFadiga(ev.target.value)} />
            {/* Os estágios viram uma régua de botões; o texto aparece só do estágio atual. */}
            <div className="fadiga-degraus" role="group" aria-label="Estágios da fadiga">
              {R.ESTAGIOS.map(s => (
                <button type="button" key={s.min} className={s.min <= f.fadiga ? 'passou' : undefined} aria-pressed={s.min === e.min} title={s.nome} onClick={() => mudarFadiga(s.min)}>
                  {String(s.min).padStart(2, '0')}%<span className="so-leitor"> {s.nome}</span>
                </button>
              ))}
            </div>
            <p className="fadiga-estagio">
              <b>{e.nome}</b>{e.txt && <span> {e.txt}</span>}
              {e.perda && <span className="fadiga-custo"> Ao fim da cena: perde {e.perda}% da mana total.</span>}
            </p>
            <button type="button" className="btn btn-forte" onClick={encerrarCena}>{perda ? `Encerrar cena: −${perda} de mana total` : 'Encerrar cena'}</button>
            <ul className="registro">
              {f.registro.slice(0, 3).map(r => <li key={r.em}>{dataCurta(r.em)}: {r.txt}</li>)}
            </ul>
          </div>

          <div className="nucleo-bloco" title={`Núcleo até aqui: +${bonus.mana} de mana, −${bonus.gasto} de gasto universal de mana, +${bonus.ap} AP`}>
            <span className="orbe" aria-hidden="true" style={{ '--orbe': COR_DO_NUCLEO[f.nucleo] } as React.CSSProperties} />
            <div className="campo-linha">
              <label htmlFor="c-nucleo">Núcleo</label>
              <select id="c-nucleo" aria-label="Estágio do núcleo" value={f.nucleo} onChange={ev => mudarComMaximos(c => { c.nucleo = R.inteiro(ev.target.value, 0, R.NUCLEOS.length - 1); }, c => ({ nucleo: c.nucleo }))}>
                {R.NUCLEOS.map((n, i) => <option key={n.nome} value={i}>{n.nome}</option>)}
              </select>
            </div>
            <p className="formula">+{bonus.mana} mana · −{bonus.gasto} gasto · +{bonus.ap} AP</p>
          </div>
        </aside>

        <section className="col-atributos" data-parte="atributos" aria-label="Atributos e elementos">
          <div className="secao-cab">
            <h2 className="titulo-grupo">Atributos</h2>
            <span className={`sp-saldo${apUsados > apMax ? ' sp-acima' : ''}`} title="Atributos, armas e elementos usam os mesmos pontos.">{apUsados} de {apMax} AP usados</span>
          </div>
          {soAjustes(campoBonus('ap', 'AP'))}
          <div className="atributos-bloco">
            <div className="grafico-atributos"><GraficoAtributos corpo={f.corpo} mente={f.mente} compacto /></div>
            <div className="atributos-linhas">
              <div className="grupo-corpo"><h3 className="subtitulo-grupo">Corpo</h3>{R.GRUPOS.corpo.map(i => linhaAttr('corpo', i))}</div>
              <div className="grupo-mente"><h3 className="subtitulo-grupo">Mente</h3>{R.GRUPOS.mente.map(i => linhaAttr('mente', i))}</div>
            </div>
          </div>

          <div className="secao-cab"><h2 className="titulo-grupo">Elementos</h2></div>
          {elementosDaFicha.length === 0 && f.elementosCriados.length === 0 && <p className="apagado">Nenhum elemento ainda.</p>}
          <div className="elementos-lista">{elementosDaFicha.map(i => linhaAttr('elementos', i, true))}</div>
          <div className="elementos-acoes">
            <ElementosCriados
              f={f} editandoLimites={editandoLimites}
              aoMudar={elementosCriados => ed.definir({ ...f, elementosCriados }, { elementosCriados })}
              aoMudarLimite={mudarLimite}
              aoRolar={atributo => rolar({ atributo })}
            />
            {elementosDaFicha.length < R.GRUPOS.elementos.length && (
              <select className="elemento-adicionar" aria-label="Adicionar elemento" value="" onChange={ev => adicionarElemento(ev.target.value)}>
                <option value="" disabled>+ Adicionar elemento</option>
                {R.GRUPOS.elementos.filter(([k]) => !elementosDaFicha.some(([el]) => el === k)).map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
              </select>
            )}
          </div>
        </section>

        <section className="col-abas" data-parte="abas" aria-label="Perícias, armas, habilidades e anotações">
          <div className="abas" role="tablist" aria-label="Seções da ficha">
            {abas.map(([id, rotulo]) => (
              <button type="button" role="tab" key={id} id={`aba-${id}`} aria-controls={`painel-${id}`} aria-selected={aba === id} onClick={() => setAba(id)}>{rotulo}</button>
            ))}
          </div>
          {/* Ficam montadas e só escondidas: trocar de aba não perde as armas e magias abertas. */}
          <div className="painel-aba" id="painel-pericias" role="tabpanel" aria-labelledby="aba-pericias" hidden={aba !== 'pericias'}>
            <div className="pericias-cab">
              <p className="grupo-desc">Limite por perícia: {Math.max(0, R.LIMITE_PERICIA_INICIAL + f.ajustes.limitePericia)}.</p>
              <span className={`sp-saldo${ppUsados > ppMax ? ' sp-acima' : ''}`}>{ppUsados} de {ppMax} PP usados</span>
            </div>
            {soAjustes(<>{campoBonus('pp', 'PP')}{campoBonus('limitePericia', 'limite por perícia')}</>)}
            <TabelaPericias
              f={f} editandoLimites={editandoLimites}
              aoMudarTreino={(k, v) => mudarAttr('pericias', k, v)}
              aoMudarOutros={(k, v) => {
                const periciasOutros = { ...f.periciasOutros, [k]: R.inteiro(v, 0, 999) };
                ed.definir({ ...f, periciasOutros }, { periciasOutros });
              }}
              aoMudarAtributo={(k, atributo) => {
                const periciasAtributo = { ...f.periciasAtributo };
                if (!atributo || atributo === R.ATRIBUTO_DA_PERICIA[k]) delete periciasAtributo[k];
                else periciasAtributo[k] = atributo;
                ed.definir({ ...f, periciasAtributo }, { periciasAtributo });
              }}
              aoMudarLimite={mudarLimite}
              aoRolar={k => rolar({ atributo: `pericias.${k}` })}
            />
          </div>
          <div className="painel-aba" id="painel-armas" role="tabpanel" aria-labelledby="aba-armas" hidden={aba !== 'armas'}>
            <div className="proficiencias">
              <h3 className="subtitulo-grupo">Proficiência</h3>
              {R.GRUPOS.armas.map(i => linhaAttr('armas', i))}
            </div>
            <Armas
              armas={f.arsenal} ataque={a => { const { valor, vantagem } = R.ataqueDaArma(f, a); return expressaoDaRolagem(valor, vantagem); }}
              aoMudar={arsenal => ed.definir({ ...f, arsenal }, { arsenal })}
              aoAtacar={a => rolar({ atributo: `arma.${a.id}` }, a.nome || undefined, a.dano.trim() !== '')} aoRolarDano={a => rolar({ atributo: `dano.${a.id}` }, a.nome ? `Dano: ${a.nome}` : undefined)}
            />
          </div>
          <div className="painel-aba" id="painel-magias" role="tabpanel" aria-labelledby="aba-magias" hidden={aba !== 'magias'}>
            <Magias
              magias={f.magias} criados={f.elementosCriados} elementos={elementosDaFicha} gastoUniversal={bonus.gasto}
              aoMudar={magias => ed.definir({ ...f, magias }, { magias })} aoConjurar={conjurar}
            />
          </div>
          <div className="painel-aba" id="painel-habilidades" role="tabpanel" aria-labelledby="aba-habilidades" hidden={aba !== 'habilidades'}>
            <Habilidades habilidades={f.habilidades} aoMudar={habilidades => ed.definir({ ...f, habilidades }, { habilidades })} />
          </div>
          {([['inventario', 'Inventário'], ['notas', 'Anotações']] as const).map(([k, rotulo]) => (
            <div className="painel-aba" id={`painel-${k}`} role="tabpanel" aria-labelledby={`aba-${k}`} hidden={aba !== k} key={k}>
              <label className="so-leitor" htmlFor={`c-${k}`}>{rotulo}</label>
              <textarea className="texto-livre" id={`c-${k}`} value={f[k]} placeholder={k === 'inventario' ? 'Itens, dinheiro, o que o personagem carrega…' : 'Pistas, nomes, o que aconteceu na sessão…'}
                onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
            </div>
          ))}
        </section>
      </div>
      {/* Só no celular: o menu substitui a barra de ações, as partes da ficha e a barra de baixo. */}
      {menuAberto && (
        <>
          <div className="menu-ficha-fundo" aria-hidden="true" onClick={() => setMenuAberto(false)} />
          <div className="menu-ficha" id="menu-ficha" role="dialog" aria-label="Menu da ficha">
            <div className="menu-ficha-topo">
              <Link className="btn" href={voltar.href}>← {voltar.txt}</Link>
              <span className="salvo">{ed.status}</span>
            </div>
            <nav className="menu-ficha-partes" aria-label="Parte da ficha">
              {PARTES_MENU.map(([id, rotulo]) => (
                <button type="button" key={id} aria-current={parteAtual === id ? 'true' : undefined} onClick={() => irPara(id)}>{rotulo}</button>
              ))}
            </nav>
            <div className="menu-ficha-acoes">
              <button type="button" className="btn" aria-pressed={editandoLimites} onClick={() => setEditandoLimites(a => !a)}>{editandoLimites ? 'Concluir ajustes' : 'Ajustes e limites'}</button>
              {f.contexto.souDono && <button type="button" className="btn" onClick={duplicar}>Duplicar</button>}
              {f.contexto.souDono && <BotaoConfirmar rotulo="Apagar" confirmar="Confirmar: apagar para sempre" aoConfirmar={apagar} />}
            </div>
          </div>
        </>
      )}
      <button type="button" className="menu-ficha-botao" aria-expanded={menuAberto} aria-controls="menu-ficha" aria-label={menuAberto ? 'Fechar o menu da ficha' : 'Abrir o menu da ficha'} onClick={() => setMenuAberto(a => !a)}>
        {menuAberto ? <X aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
      </button>
      <ChatFlutuante
        chat={chat}
        escopo={campanha ? `${campanha.nome}: todos da mesa veem` : 'Só você vê: esta ficha não está em campanha'}
        aoRolar={(lados, bonusDado) => rolar({ lados, bonus: bonusDado })}
      />
    </article>
  );
}
