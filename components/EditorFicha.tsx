'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import AjusteFoto, { fotoDaTela } from '@/components/AjusteFoto';
import { ChatFlutuante } from '@/components/Chat';
import { BotaoConfirmar, CampoNumero, Capitular } from '@/components/comuns';
import ElementosCriados from '@/components/ElementosCriados';
import Magias from '@/components/Magias';
import Pentagrama from '@/components/Pentagrama';
import { api, dataCurta, mensagem, pct, virgula } from '@/lib/cliente';
import { MOLDURA_FOTO } from '@/lib/enquadramento';
import * as R from '@/lib/regras';
import type { Ficha, Mensagem } from '@/lib/tipos';
import type { useChat } from '@/lib/useChat';
import type { useFichaEditavel } from '@/lib/useFicha';

/* Na ordem de `NUCLEOS`: o núcleo clareia de vermelho até branco conforme o personagem avança. */
const COR_DO_NUCLEO = ['#7a1414', '#b3201c', '#e5443a', '#b34d0f', '#e8771c', '#f6a24b', '#a8860a', '#e3bd1f', '#f7e35d', '#8e99a8', '#c3ccd6', '#e9eef2', '#ffffff'];

const CAMPOS_TEXTO = [
  ['player', 'Player', true], ['nome', 'Nome', true], ['idade', 'Idade', false], ['raca', 'Raça', false], ['estilo', 'Estilo de magia', true],
] as const;

export default function EditorFicha({ f, ed, chat }: {
  f: Ficha; ed: ReturnType<typeof useFichaEditavel>; chat: ReturnType<typeof useChat>;
}) {
  const router = useRouter();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [fotoEscolhida, setFotoEscolhida] = useState<File | null>(null);
  const [editandoLimites, setEditandoLimites] = useState(false);
  const [aba, setAba] = useState<'atributos' | 'magias'>('atributos');
  /* Só o celular usa: no computador, as três colunas ficam sempre à vista. */
  const [secao, setSecao] = useState<'cena' | 'perfil' | 'habilidades'>('cena');
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
  async function enviarFoto(foto: string) {
    try {
      ed.setStatus('Salvando…');
      const r = await api<{ ficha: Ficha }>('PATCH', url, { foto });
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
    return (
      <div className={`attr${cor ? ` c-${k}` : ''}`} key={k}>
        <label htmlFor={idCampo}>{cor && <span className="ponto" />}{rotulo}{desc && <small>{desc}</small>}{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
        <div className="passo">
          <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] - 1)}>−</button>
          <CampoNumero id={idCampo} min={0} valor={f[g][k]} aoMudar={v => mudarAttr(g, k, v)} />
          <button type="button" disabled={travado} aria-label={`Aumentar ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] + 1)}>+</button>
        </div>
        <button type="button" className="rolar" title={`Rolar d20${g === 'pericias' && R.dadoAdicional(f[g][k]) ? ` + d${R.dadoAdicional(f[g][k])}` : ''} + ${rotulo}`} aria-label={`Rolar d20 mais ${rotulo}`} onClick={() => rolar({ atributo: `${g}.${k}` })}>d20</button>
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
        <span className="vital-num"><CampoNumero id={`v-${chave}`} min={0} aoVivo valor={atual} aoMudar={v => mudarVital(chave, v)} /><span>/ <b>{max}</b></span></span>
      </div>
      <span className="barra"><i style={{ width: `${pct(atual, max)}%` }} /></span>
      <div className="vital-botoes">
        {[-5, -1, 1, 5].map(d => <button type="button" key={d} onClick={() => mudarVital(chave, atual + d)}>{d > 0 ? '+' : '−'}{Math.abs(d)}</button>)}
      </div>
      <p className="formula">{formula}</p>
      {extra}
    </div>
  );

  const sub = [f.raca, f.estilo, `Tier ${f.tier}`, f.idade && `${f.idade} anos`].filter(Boolean).join(' · ');
  const base = R.manaBase(f);
  const bonus = R.bonusNucleo(f.nucleo), spUsados = R.spGastos(f), spMax = R.spTotal(f);
  const parcelaMestre = (v: number) => (v ? ` ${v > 0 ? '+' : '−'} mestre ${Math.abs(v)}` : '');
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
        <span className="orbe placa-orbe" aria-hidden="true" style={{ '--orbe': COR_DO_NUCLEO[f.nucleo] } as React.CSSProperties} />
        <h1 className="placa-nome">{perdido ? '???' : f.nome || 'Sem nome'}</h1>
        <p className="placa-sub">{perdido ? '???' : sub}</p>
        <svg className="fenda" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,62 90,48 170,71 260,38 330,55 430,20 490,64 590,44 650,78 760,30 840,58 920,36 1000,70" />
          <polyline points="430,20 462,0" />
          <polyline points="650,78 690,100" />
        </svg>
      </header>

      <div className="ficha-secoes" role="group" aria-label="Parte da ficha">
        {([['cena', 'Cena'], ['perfil', 'Perfil'], ['habilidades', 'Habilidades']] as const).map(([id, rotulo]) => (
          <button type="button" key={id} aria-pressed={secao === id} onClick={() => { setSecao(id); window.scrollTo({ top: 0 }); }}>{rotulo}</button>
        ))}
      </div>
      <div className="ficha-grade" data-secao={secao}>
        <section className="col-id" aria-label="Identidade">
          <div className="bloco-foto">
            {perdido ? <span className="capitular retrato">???</span> : <Capitular className="retrato" nome={f.nome} fichaId={f.id} fotoV={f.fotoV} />}
            <div className="foto-botoes">
              <button type="button" className="btn" onClick={() => entradaFoto.current?.click()}>Trocar foto</button>
              {f.fotoV > 0 && <button type="button" className="btn" onClick={() => enviarFoto('')}>Remover</button>}
            </div>
            <input ref={entradaFoto} id="foto-arquivo" type="file" accept="image/*" hidden onChange={ev => {
              const a = ev.target.files?.[0];
              ev.target.value = '';
              if (a) setFotoEscolhida(a);
            }} />
            {fotoEscolhida && (
              <AjusteFoto
                key={`${fotoEscolhida.name}-${fotoEscolhida.lastModified}`}
                arquivo={fotoEscolhida}
                titulo="Ajustar a foto"
                moldura={MOLDURA_FOTO}
                aoCancelar={() => setFotoEscolhida(null)}
                aoFalhar={() => { setFotoEscolhida(null); toast.error('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.'); }}
                aoSalvar={tela => { const foto = fotoDaTela(tela); setFotoEscolhida(null); void enviarFoto(foto); }}
              />
            )}
          </div>
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
        </section>

        <section className="col-attr" aria-label="Atributos e magias">
          <div className="abas" role="tablist" aria-label="Seções da ficha">
            <button type="button" role="tab" id="aba-atributos" aria-controls="painel-atributos" aria-selected={aba === 'atributos'} onClick={() => setAba('atributos')}>Atributos</button>
            <button type="button" role="tab" id="aba-magias" aria-controls="painel-magias" aria-selected={aba === 'magias'} onClick={() => setAba('magias')}>Magias ({f.magias.length})</button>
          </div>
          {/* Fica montado e só escondido: trocar de aba não fecha as categorias de perícia já abertas. */}
          <div className="painel-aba" id="painel-atributos" role="tabpanel" aria-labelledby="aba-atributos" hidden={aba !== 'atributos'}>
            <div>
              <div className="cab-grupo"><h2 className="titulo-grupo">Atributos</h2></div>
              <div className="elementos-corpo">
                <div className="pentagrama"><Pentagrama valores={f.elementos} /></div>
                <div className="elementos-lista">{R.GRUPOS.elementos.map(i => linhaAttr('elementos', i, true))}</div>
              </div>
              <ElementosCriados
                f={f} souMestre={souMestre} editandoLimites={editandoLimites}
                aoMudar={elementosCriados => ed.definir({ ...f, elementosCriados }, { elementosCriados })}
                aoMudarLimite={mudarLimite}
                aoRolar={atributo => rolar({ atributo })}
              />
            </div>
            <div className="duas-col">
              <div className="grupo-corpo">
                <div className="cab-grupo"><h2 className="titulo-grupo">Corpo</h2></div>
                {R.GRUPOS.corpo.map(i => linhaAttr('corpo', i))}
              </div>
              <div>
                <div className="cab-grupo"><h2 className="titulo-grupo">Mente</h2></div>
                {R.GRUPOS.mente.map(i => linhaAttr('mente', i))}
              </div>
            </div>
            <div>
              <div className="cab-grupo"><h2 className="titulo-grupo">Armas</h2></div>
              <div className="lista-armas">{R.GRUPOS.armas.map(i => linhaAttr('armas', i))}</div>
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
            <div>
              <div className="cab-grupo cab-pericias">
                <h2 className="titulo-grupo">Perícias</h2>
                <span className={`sp-saldo${spUsados > spMax ? ' sp-acima' : ''}`}>{spUsados} de {spMax} SP usados</span>
              </div>
              {campoBonus('sp', 'SP')}
              {R.PERICIAS.map(c => (
                <details className="categoria-pericia" key={c.categoria}>
                  <summary>{c.categoria}</summary>
                  <div className="lista-armas">{c.itens.map(i => linhaAttr('pericias', i))}</div>
                </details>
              ))}
            </div>
            <div className="duas-col">
              {([['inventario', 'Inventário'], ['notas', 'Anotações']] as const).map(([k, rotulo]) => (
                <div className="campo" key={k}>
                  <label className="rotulo" htmlFor={`c-${k}`}>{rotulo}</label>
                  <textarea id={`c-${k}`} value={f[k]} onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <div className="painel-aba" id="painel-magias" role="tabpanel" aria-labelledby="aba-magias" hidden={aba !== 'magias'}>
            <Magias
              magias={f.magias} criados={f.elementosCriados} gastoUniversal={bonus.gasto}
              aoMudar={magias => ed.definir({ ...f, magias }, { magias })} aoConjurar={conjurar}
            />
          </div>
        </section>

        <aside className="col-cena" aria-label="Em cena">
          {blocoVital('vidaAtual', 'Vida', 'cor-vida', f.vidaAtual, vm, `15 + vitalidade ${f.corpo.vitalidade} × 2${bonus.pv ? ` + núcleo ${bonus.pv}` : ''}${parcelaMestre(f.ajustes.vida)} = ${vm}`, campoBonus('vida', 'vida'))}
          {blocoVital('manaAtual', 'Mana', 'cor-mana', f.manaAtual, mm,
            `30 + onipotência ${f.mente.onipotencia} × ${virgula(R.TIERS[f.tier])} (tier ${f.tier})${bonus.mana ? ` + núcleo ${bonus.mana}` : ''}${parcelaMestre(f.ajustes.mana)} = ${base}${f.manaPerdida ? `, menos ${f.manaPerdida} perdida = ${mm}` : ''}`,
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
