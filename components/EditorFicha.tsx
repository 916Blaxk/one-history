'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Axe, Droplets, Feather, Flame, HeartPulse, Mountain, Sword, Wind, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import AjusteFoto, { arquivoDeDataUrl, fotoDaTela } from '@/components/AjusteFoto';
import { ChatFlutuante } from '@/components/Chat';
import { BotaoConfirmar, CampoNumero, Capitular } from '@/components/comuns';
import ElementosCriados from '@/components/ElementosCriados';
import GraficoAtributos from '@/components/GraficoAtributos';
import Habilidades from '@/components/Habilidades';
import Magias from '@/components/Magias';
import TabelaPericias from '@/components/TabelaPericias';
import { api, dataCurta, mensagem, pct, virgula } from '@/lib/cliente';
import { MOLDURA_FOTO, type Enquadramento } from '@/lib/enquadramento';
import * as R from '@/lib/regras';
import type { Ficha, Mensagem } from '@/lib/tipos';
import type { useChat } from '@/lib/useChat';
import type { useFichaEditavel } from '@/lib/useFicha';

/* Na ordem de `NUCLEOS`: o núcleo clareia de vermelho até branco conforme o personagem avança. */
const COR_DO_NUCLEO = ['#7a1414', '#b3201c', '#e5443a', '#b34d0f', '#e8771c', '#f6a24b', '#a8860a', '#e3bd1f', '#f7e35d', '#8e99a8', '#c3ccd6', '#e9eef2', '#ffffff'];

const ICONES: Record<string, LucideIcon> = { fogo: Flame, agua: Droplets, vento: Wind, terra: Mountain, cura: HeartPulse, leves: Feather, medias: Sword, pesadas: Axe };
/* Só para desenhar a barra: valores maiores continuam valendo. */
const TETO_DA_BARRA = 20;

const CAMPOS_TEXTO = [
  ['player', 'Player', true], ['nome', 'Nome', true], ['idade', 'Idade', false], ['raca', 'Raça', false], ['estilo', 'Estilo de magia', true],
] as const;

export default function EditorFicha({ f, ed, chat }: {
  f: Ficha; ed: ReturnType<typeof useFichaEditavel>; chat: ReturnType<typeof useChat>;
}) {
  const router = useRouter();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [fotoEscolhida, setFotoEscolhida] = useState<{ arquivo: File; original?: string; ajuste?: Enquadramento | null } | null>(null);
  const [editandoLimites, setEditandoLimites] = useState(false);
  const [aba, setAba] = useState<'atributos' | 'pericias' | 'magias' | 'habilidades'>('atributos');
  /* Só o celular usa: no computador, as três colunas ficam sempre à vista. */
  const [secao, setSecao] = useState<'cena' | 'perfil' | 'atributos'>('cena');
  const souMestre = f.contexto.souMestre;
  /* O servidor aplica a mesma regra: aqui é só para não oferecer o que não vai valer. */
  const podeMudarFadiga = souMestre || !f.contexto.campanha;
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
  const mudarAttr = (g: R.Grupo, k: string, v: unknown) => mudarComMaximos(c => {
    const pedido = R.inteiro(v, 0, 999);
    c[g][k] = pedido;
    if (souMestre) return;
    R.aplicarTravasDoJogador(c, f);
    if (c[g][k] < pedido) toast.error('Esse valor passa do limite do mestre ou dos SP disponíveis.');
  }, c => ({ [g]: { [k]: c[g][k] } }));
  const mudarAjuste = (chave: keyof R.AjustesMestre, v: unknown) =>
    mudarComMaximos(c => { c.ajustes[chave] = R.inteiro(v, -9999, 9999); }, c => ({ ajustes: { [chave]: c.ajustes[chave] } }));
  /* A pessoa digita o total, e a diferença para a fórmula vira o ajuste: subir vitalidade ou núcleo continua somando. */
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
    toast(`${nome}: −${custo} de mana${m.dano ? `. Dano: ${m.dano}` : ''}`);
  }

  async function rolar(corpo: Record<string, unknown>) {
    try {
      /* A rolagem de atributo usa o valor guardado no servidor: salva antes o que ainda está pendente. */
      await ed.salvarAgora();
      const r = await api<{ rolagem: Mensagem }>('POST', `${url}/rolar`, corpo);
      chat.receber(r.rolagem);
      /* Com o chat aberto, o resultado já aparece nele. */
      if (!chat.aberto) chat.setDestaque(r.rolagem);
    } catch (err) { toast.error(mensagem(err)); }
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
    const travado = !souMestre && ((limite !== undefined && f[g][k] >= limite) || (g === 'pericias' && R.spGastos(f) >= R.spTotal(f)));
    const Icone = ICONES[k];
    const vantagem = R.vantagemDaRolagem(f, g, k), dados = vantagem ? `${vantagem + 1}d20, fica o maior` : 'd20';
    return (
      <div className={`attr${cor ? ` c-${k}` : ''}`} data-grupo={g} data-ativo={f[g][k] > 0} key={k}>
        <label htmlFor={idCampo}>{Icone && <Icone className="attr-icone" aria-hidden="true" />}{rotulo}{desc && <small>{desc}</small>}{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
        <div className="passo">
          <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] - 1)}>−</button>
          <CampoNumero id={idCampo} min={0} valor={f[g][k]} aoMudar={v => mudarAttr(g, k, v)} />
          <button type="button" disabled={travado} aria-label={`Aumentar ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] + 1)}>+</button>
        </div>
        <button type="button" className="rolar" title={R.somaNaRolagem(g) ? `Rolar ${dados}, + ${rotulo}` : `Rolar ${dados}`} aria-label={R.somaNaRolagem(g) ? `Rolar d20 mais ${rotulo}` : `Rolar d20 de ${rotulo}`} onClick={() => rolar({ atributo: `${g}.${k}` })}>d20</button>
        {cor && <span className="attr-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, f[g][k] / TETO_DA_BARRA * 100)}%` }} /></span>}
        {cor && <div className="elemento-remover"><BotaoConfirmar className="btn btn-pequeno" rotulo={`Remover ${rotulo}`} confirmar="Confirmar: remover" aoConfirmar={() => removerElemento(k)} /></div>}
        {souMestre && editandoLimites && (
          <label className="campo-limite">
            Limite de {rotulo}
            <input type="number" inputMode="numeric" min={0} max={999} placeholder="Sem limite" value={limite ?? ''} onChange={ev => mudarLimite(chave, ev.target.value)} />
          </label>
        )}
      </div>
    );
  };
  const blocoVital = (chave: 'vidaAtual' | 'manaAtual', rotulo: string, classe: string, atual: number, max: number, formula: string, extra?: React.ReactNode) => (
    <div className={`vital ${classe}`}>
      <div className="vital-topo">
        <label className="vital-rot" htmlFor={`v-${chave}`}>{rotulo}</label>
        <span className="vital-num"><CampoNumero id={`v-${chave}`} min={0} aoVivo valor={atual} aoMudar={v => mudarVital(chave, v)} /><span>/ {chave === 'vidaAtual' ? <CampoNumero id="v-vidaMaxima" aria-label="Vida máxima" min={0} valor={max} aoMudar={mudarVidaMaxima} /> : <b>{max}</b>}</span></span>
      </div>
      <span className="barra"><i style={{ width: `${pct(atual, max)}%` }} /></span>
      <div className="vital-botoes">
        {[-5, -1, 1, 5].map(d => <button type="button" key={d} onClick={() => mudarVital(chave, atual + d)}>{d > 0 ? '+' : '−'}{Math.abs(d)}</button>)}
      </div>
      <p className="formula">{formula}</p>
      {extra}
    </div>
  );

  const chips = [f.player, f.idade && `${f.idade} anos`, f.raca, f.estilo].filter(Boolean);
  const base = R.manaBase(f);
  const bonus = R.bonusNucleo(f.nucleo), spUsados = R.spGastos(f), spMax = R.spTotal(f);
  const parcelaAjuste = (v: number) => (v ? ` ${v > 0 ? '+' : '−'} ajuste ${Math.abs(v)}` : '');
  const campoBonus = (chave: keyof R.AjustesMestre, nome: string) => souMestre && (
    <label className="perda-perm" htmlFor={`c-ajuste-${chave}`}>
      Bônus do mestre em {nome}
      <CampoNumero id={`c-ajuste-${chave}`} valor={f.ajustes[chave]} aoMudar={v => mudarAjuste(chave, v)} />
    </label>
  );

  return (
    <article className="ficha" data-estagio={e.min}>
      <div className="veu" data-estagio={e.min} aria-hidden="true" />
      <div className="ficha-barra">
        <Link className="btn" href={voltar.href}>← {voltar.txt}</Link>
        <span className="salvo" role="status">{ed.status}</span>
        {campanha && !f.contexto.souMestre && <Link className="btn" href={`/campanhas/${campanha.id}`}>Campanha: {campanha.nome}</Link>}
        {f.contexto.souMestre && !f.contexto.souDono && <span className="selo">Ficha de {f.contexto.donoNome}</span>}
        <span className="espaco" />
        {souMestre && <button type="button" className="btn" aria-pressed={editandoLimites} onClick={() => setEditandoLimites(a => !a)}>{editandoLimites ? 'Concluir limites' : 'Definir limites'}</button>}
        {f.contexto.souDono && <button type="button" className="btn" onClick={duplicar}>Duplicar</button>}
        {f.contexto.souDono && <BotaoConfirmar rotulo="Apagar" confirmar="Confirmar: apagar para sempre" aoConfirmar={apagar} />}
      </div>
      <header className="placa">
        <div className="bloco-foto">
          {perdido ? <span className="capitular retrato">???</span> : <Capitular className="retrato" nome={f.nome} fichaId={f.id} fotoV={f.fotoV} />}
          <div className="foto-botoes">
            <button type="button" className="btn" onClick={() => entradaFoto.current?.click()}>Trocar foto</button>
            {f.fotoV > 0 && <button type="button" className="btn" onClick={reajustarFoto}>Ajustar</button>}
            {f.fotoV > 0 && <button type="button" className="btn" onClick={() => enviarFoto('')}>Remover</button>}
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
          <ul className="placa-chips">
            {perdido ? <li>???</li> : chips.map(c => <li key={c}>{c}</li>)}
            {!perdido && <li className="chip-tier">Tier {f.tier}</li>}
          </ul>
        </div>
        <svg className="fenda" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,62 90,48 170,71 260,38 330,55 430,20 490,64 590,44 650,78 760,30 840,58 920,36 1000,70" />
          <polyline points="430,20 462,0" />
          <polyline points="650,78 690,100" />
        </svg>
      </header>

      <div className="ficha-secoes" role="group" aria-label="Parte da ficha">
        {([['cena', 'Cena'], ['perfil', 'Perfil'], ['atributos', 'Atributos']] as const).map(([id, rotulo]) => (
          <button type="button" key={id} aria-pressed={secao === id} onClick={() => { setSecao(id); window.scrollTo({ top: 0 }); }}>{rotulo}</button>
        ))}
      </div>
      <div className="ficha-grade" data-secao={secao}>
        <section className="col-id" aria-label="Identidade">
          <div className="campos">
            {CAMPOS_TEXTO.map(([k, rotulo, largo]) => (
              <div className={`campo${largo ? ' campo-largo' : ''}`} key={k}>
                <label className="rotulo" htmlFor={`c-${k}`}>{rotulo}</label>
                <input id={`c-${k}`} type="text" value={f[k]} onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
              </div>
            ))}
            <fieldset className="tiers" aria-label="Tier">
              {[1, 2, 3].map(t => (
                <label className="tier" key={t}>
                  <input type="radio" name="tier" id={`c-tier-${t}`} checked={f.tier === t} onChange={() => mudarComMaximos(c => { c.tier = t; }, () => ({ tier: t }))} />
                  <b>Tier {t}</b><small>× {virgula(R.TIERS[t])}</small>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="bloco-nucleo">
            <div className="cab-grupo"><h2 className="titulo-grupo">Núcleo</h2></div>
            <div className="nucleo-linha">
              <span className="orbe" aria-hidden="true" style={{ '--orbe': COR_DO_NUCLEO[f.nucleo] } as React.CSSProperties} />
              <span className="nucleo-nome">{R.NUCLEOS[f.nucleo].nome}</span>
            </div>
            <div className="campo">
              <label className="rotulo" htmlFor="c-nucleo">Estágio do núcleo</label>
              <select id="c-nucleo" disabled={!souMestre} value={f.nucleo} onChange={ev => mudarComMaximos(c => { c.nucleo = R.inteiro(ev.target.value, 0, R.NUCLEOS.length - 1); }, c => ({ nucleo: c.nucleo }))}>
                {R.NUCLEOS.map((n, i) => <option key={n.nome} value={i}>{n.nome}</option>)}
              </select>
            </div>
            {!souMestre && <p className="formula">Só o mestre da campanha muda o estágio do núcleo.</p>}
            {R.NUCLEOS[f.nucleo].txt && <p className="formula">{R.NUCLEOS[f.nucleo].txt}</p>}
            <p className="formula">Total até aqui: +{bonus.mana} de mana, −{bonus.gasto} de gasto universal de mana, {bonus.sp} SP, +{bonus.pv} de vida</p>
          </div>
                      {([['inventario', 'Inventário'], ['notas', 'Anotações']] as const).map(([k, rotulo]) => (
            <div className="campo" key={k}>
              <label className="rotulo" htmlFor={`c-${k}`}>{rotulo}</label>
              <textarea id={`c-${k}`} value={f[k]} onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
            </div>
          ))}
        </section>

        <section className="col-attr" aria-label="Atributos e magias">
          <div className="abas" role="tablist" aria-label="Seções da ficha">
            <button type="button" role="tab" id="aba-atributos" aria-controls="painel-atributos" aria-selected={aba === 'atributos'} onClick={() => setAba('atributos')}>Atributos</button>
            <button type="button" role="tab" id="aba-pericias" aria-controls="painel-pericias" aria-selected={aba === 'pericias'} onClick={() => setAba('pericias')}>Perícias</button>
            <button type="button" role="tab" id="aba-magias" aria-controls="painel-magias" aria-selected={aba === 'magias'} onClick={() => setAba('magias')}>Magias ({f.magias.length})</button>
            <button type="button" role="tab" id="aba-habilidades" aria-controls="painel-habilidades" aria-selected={aba === 'habilidades'} onClick={() => setAba('habilidades')}>Habilidades ({f.habilidades.length})</button>
          </div>
          {/* Ficam montadas e só escondidas: trocar de aba não perde o filtro de perícias nem as magias abertas. */}
          <div className="painel-aba" id="painel-atributos" role="tabpanel" aria-labelledby="aba-atributos" hidden={aba !== 'atributos'}>
            <div>
              <div className="cab-grupo"><h2 className="titulo-grupo">Elementos</h2></div>
              <p className="grupo-desc">Afinidades mágicas: fogo, água, vento...</p>
              {elementosDaFicha.length === 0 && f.elementosCriados.length === 0 && <p className="apagado">Nenhum elemento ainda. Adicione as afinidades do personagem.</p>}
              <div className="elementos-lista">{elementosDaFicha.map(i => linhaAttr('elementos', i, true))}</div>
              <ElementosCriados
                f={f} souMestre={souMestre} editandoLimites={editandoLimites}
                aoMudar={elementosCriados => ed.definir({ ...f, elementosCriados }, { elementosCriados })}
                aoMudarLimite={mudarLimite}
                aoRolar={atributo => rolar({ atributo })}
              />
              {elementosDaFicha.length < R.GRUPOS.elementos.length && (
                <select className="elemento-adicionar" aria-label="Adicionar elemento" value="" onChange={ev => adicionarElemento(ev.target.value)}>
                  <option value="" disabled>+ Adicionar elemento</option>
                  {R.GRUPOS.elementos.filter(([k]) => !elementosDaFicha.some(([e]) => e === k)).map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
                </select>
              )}
            </div>
            <div>
              <div className="cab-grupo"><h2 className="titulo-grupo">Atributos</h2></div>
              <p className="grupo-desc">Corpo e mente: tração, vitalidade, encanto...</p>
              <div className="atributos-corpo">
              <div className="grafico-atributos"><GraficoAtributos corpo={f.corpo} mente={f.mente} /></div>
              <div className="duas-col">
                <div className="grupo-corpo">
                  <h3 className="subtitulo-grupo">Corpo</h3>
                  {R.GRUPOS.corpo.map(i => linhaAttr('corpo', i))}
                </div>
                <div className="grupo-mente">
                  <h3 className="subtitulo-grupo">Mente</h3>
                  {R.GRUPOS.mente.map(i => linhaAttr('mente', i))}
                </div>
              </div>
              </div>
            </div>
            <div>
              <div className="cab-grupo"><h2 className="titulo-grupo">Armas</h2></div>
              <div className="lista-armas">{R.GRUPOS.armas.map(i => linhaAttr('armas', i))}</div>
            </div>
          </div>
          <div className="painel-aba" id="painel-pericias" role="tabpanel" aria-labelledby="aba-pericias" hidden={aba !== 'pericias'}>
            <div>
              <div className="cab-grupo cab-pericias">
                <h2 className="titulo-grupo">Perícias</h2>
                <span className={`sp-saldo${spUsados > spMax ? ' sp-acima' : ''}`}>{spUsados} de {spMax} SP usados</span>
              </div>
              {campoBonus('sp', 'SP')}
              <TabelaPericias
                f={f} souMestre={souMestre} editandoLimites={editandoLimites}
                aoMudarTreino={(k, v) => mudarAttr('pericias', k, v)}
                aoMudarOutros={(k, v) => {
                  const periciasOutros = { ...f.periciasOutros, [k]: R.inteiro(v, 0, 999) };
                  ed.definir({ ...f, periciasOutros }, { periciasOutros });
                }}
                aoMudarLimite={mudarLimite}
                aoRolar={k => rolar({ atributo: `pericias.${k}` })}
              />
            </div>
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
        </section>

        <aside className="col-cena" aria-label="Em cena">
          {blocoVital('vidaAtual', 'Vida', 'cor-vida', f.vidaAtual, vm, `15 + vitalidade ${f.corpo.vitalidade} × 2${bonus.pv ? ` + núcleo ${bonus.pv}` : ''}${parcelaAjuste(f.ajustes.vida)} = ${vm}`, campoBonus('vida', 'vida'))}
          {blocoVital('manaAtual', 'Mana', 'cor-mana', f.manaAtual, mm,
            `30 + onipotência ${f.mente.onipotencia} × ${virgula(R.TIERS[f.tier])} (tier ${f.tier})${bonus.mana ? ` + núcleo ${bonus.mana}` : ''}${parcelaAjuste(f.ajustes.mana)} = ${base}${f.manaPerdida ? `, menos ${f.manaPerdida} perdida = ${mm}` : ''}`,
            <>
              {campoBonus('mana', 'mana')}
              <label className="perda-perm" htmlFor="c-mana-perdida">
                Mana total perdida para sempre
                <CampoNumero id="c-mana-perdida" min={0} valor={f.manaPerdida} aoMudar={v => mudarComMaximos(c => { c.manaPerdida = R.inteiro(v, 0, 99999); }, c => ({ manaPerdida: c.manaPerdida }))} />
              </label>
            </>)}

          <div className="fadiga">
            <div className="vital-topo">
              <label className="vital-rot" htmlFor="v-fadiga">Fadiga mental</label>
              <span className="vital-num"><CampoNumero id="v-fadiga" min={0} max={100} aoVivo disabled={!podeMudarFadiga} valor={f.fadiga} aoMudar={mudarFadiga} /><span>%</span></span>
            </div>
            <input id="r-fadiga" type="range" min={0} max={100} step={1} disabled={!podeMudarFadiga} value={f.fadiga} aria-label="Fadiga mental em porcentagem" onChange={ev => mudarFadiga(ev.target.value)} />
            {!podeMudarFadiga && <p className="formula">Só o mestre da campanha muda a fadiga mental.</p>}
            <ol className="escada">
              {R.ESTAGIOS.map(s => (
                <li key={s.min}>
                  <button type="button" className={`degrau est-${s.min}${s.min <= f.fadiga ? ' passou' : ''}`} aria-current={s.min === e.min ? 'true' : undefined} disabled={!podeMudarFadiga} onClick={() => mudarFadiga(s.min)}>
                    <b>{String(s.min).padStart(2, '0')}%</b>
                    <span className="degrau-nome">{s.nome}</span>
                    {s.txt && <span className="degrau-txt">{s.txt}</span>}
                    {s.perda && <span className="degrau-custo">Ao fim da cena: perde {s.perda}% da mana total</span>}
                  </button>
                </li>
              ))}
            </ol>
            {/* A mesma regra da fadiga: em campanha é do mestre; fora dela, não há mestre, e quem cuida é o dono. */}
            {podeMudarFadiga && <button type="button" className="btn btn-forte" onClick={encerrarCena}>{perda ? `Encerrar cena: −${perda} de mana total` : 'Encerrar cena'}</button>}
            <ul className="registro">
              {f.registro.slice(0, 3).map(r => <li key={r.em}>{dataCurta(r.em)}: {r.txt}</li>)}
            </ul>
          </div>

        </aside>
      </div>
      <ChatFlutuante
        chat={chat}
        escopo={campanha ? `${campanha.nome}: todos da mesa veem` : 'Só você vê: esta ficha não está em campanha'}
        aoRolar={(lados, bonusDado) => rolar({ lados, bonus: bonusDado })}
      />
    </article>
  );
}
