'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef } from 'react';
import { toast } from 'sonner';
import { ChatFlutuante } from '@/components/Chat';
import { BotaoConfirmar, CampoNumero, Capitular } from '@/components/comuns';
import Pentagrama from '@/components/Pentagrama';
import { api, dataCurta, mensagem, pct, virgula } from '@/lib/cliente';
import * as R from '@/lib/regras';
import type { Ficha, Mensagem } from '@/lib/tipos';
import { useChat } from '@/lib/useChat';
import { useFichaEditavel } from '@/lib/useFicha';

const CAMPOS_TEXTO = [
  ['player', 'Player', true], ['nome', 'Nome', true], ['idade', 'Idade', false], ['raca', 'Raça', false], ['estilo', 'Estilo de magia', true],
] as const;

function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo), img = new Image();
    img.onload = () => {
      const L = 320, A = 400, c = document.createElement('canvas');
      c.width = L; c.height = A;
      const e = Math.max(L / img.width, A / img.height), w = img.width * e, h = img.height * e;
      c.getContext('2d')!.drawImage(img, (L - w) / 2, (A - h) / 2, w, h);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem')); };
    img.src = url;
  });
}

export default function PaginaFicha() {
  const { id } = useParams<{ id: string }>();
  const ed = useFichaEditavel(id);
  if (ed.erro && !ed.ficha) {
    return (
      <section className="vazio">
        <h2>Não consegui abrir esta ficha</h2>
        <p>{mensagem(ed.erro)}</p>
        <Link className="btn" href="/fichas">Voltar para minhas fichas</Link>
      </section>
    );
  }
  if (!ed.ficha) return <p className="apagado">Abrindo a ficha…</p>;
  return <Editor f={ed.ficha} ed={ed} />;
}

function Editor({ f, ed }: { f: Ficha; ed: ReturnType<typeof useFichaEditavel> }) {
  const router = useRouter();
  const entradaFoto = useRef<HTMLInputElement>(null);
  const url = `/api/fichas/${f.id}`;
  /* Em campanha, o chat é o da mesa inteira. Fora dela, é só desta ficha. */
  const chat = useChat(f.campanhaId ? `/api/campanhas/${f.campanhaId}/chat` : `${url}/chat`);
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
  const mudarVital = (chave: 'vidaAtual' | 'manaAtual', v: unknown) => {
    const valor = R.inteiro(v, 0, chave === 'vidaAtual' ? vm : mm);
    ed.definir({ ...f, [chave]: valor }, { [chave]: valor });
  };
  const mudarFadiga = (v: unknown) => {
    const fadiga = R.inteiro(v, 0, 100);
    ed.definir({ ...f, fadiga }, { fadiga });
  };

  async function rolar(corpo: Record<string, unknown>) {
    /* Abre antes da resposta: o chat já está na tela quando o resultado chega e gira. */
    chat.setAberto(true);
    try {
      /* A rolagem de atributo usa o valor guardado no servidor: salva antes o que ainda está pendente. */
      await ed.salvarAgora();
      const r = await api<{ rolagem: Mensagem }>('POST', `${url}/rolar`, corpo);
      chat.receber(r.rolagem);
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
    return (
      <div className={`attr${cor ? ` c-${k}` : ''}`} key={k}>
        <label htmlFor={idCampo}>{cor && <span className="ponto" />}{rotulo}{desc && <small>{desc}</small>}</label>
        <div className="passo">
          <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] - 1)}>−</button>
          <CampoNumero id={idCampo} min={0} valor={f[g][k]} aoMudar={v => mudarAttr(g, k, v)} />
          <button type="button" aria-label={`Aumentar ${rotulo}`} onClick={() => mudarAttr(g, k, f[g][k] + 1)}>+</button>
        </div>
        <button type="button" className="rolar" title={`Rolar d20 + ${rotulo}`} aria-label={`Rolar d20 mais ${rotulo}`} onClick={() => rolar({ atributo: `${g}.${k}` })}>d20</button>
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

  return (
    <article className="ficha" data-estagio={e.min}>
      <div className="veu" data-estagio={e.min} aria-hidden="true" />
      <div className="ficha-barra">
        <Link className="btn" href={voltar.href}>← {voltar.txt}</Link>
        <span className="salvo" role="status">{ed.status}</span>
        {campanha && !f.contexto.souMestre && <Link className="btn" href={`/campanhas/${campanha.id}`}>Campanha: {campanha.nome}</Link>}
        {f.contexto.souMestre && !f.contexto.souDono && <span className="selo">Ficha de {f.contexto.donoNome}</span>}
        <span className="espaco" />
        {f.contexto.souDono && <button type="button" className="btn" onClick={duplicar}>Duplicar</button>}
        {f.contexto.souDono && <BotaoConfirmar rotulo="Apagar" confirmar="Confirmar: apagar para sempre" aoConfirmar={apagar} />}
      </div>
      <header className="placa">
        <h1 className="placa-nome">{perdido ? '???' : f.nome || 'Sem nome'}</h1>
        <p className="placa-sub">{perdido ? '???' : sub}</p>
        <svg className="fenda" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,62 90,48 170,71 260,38 330,55 430,20 490,64 590,44 650,78 760,30 840,58 920,36 1000,70" />
          <polyline points="430,20 462,0" />
          <polyline points="650,78 690,100" />
        </svg>
      </header>

      <div className="ficha-grade">
        <section className="col-id" aria-label="Identidade">
          <div className="bloco-foto">
            {perdido ? <span className="capitular retrato">???</span> : <Capitular className="retrato" nome={f.nome} fichaId={f.id} fotoV={f.fotoV} />}
            <div className="foto-botoes">
              <button type="button" className="btn" onClick={() => entradaFoto.current?.click()}>Trocar foto</button>
              {f.fotoV > 0 && <button type="button" className="btn" onClick={() => enviarFoto('')}>Remover</button>}
            </div>
            <input ref={entradaFoto} id="foto-arquivo" type="file" accept="image/*" hidden onChange={async ev => {
              const a = ev.target.files?.[0];
              ev.target.value = '';
              if (!a) return;
              try { await enviarFoto(await reduzirFoto(a)); }
              catch { toast.error('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.'); }
            }} />
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

        <section className="col-attr" aria-label="Atributos">
          <div>
            <div className="cab-grupo"><h2 className="titulo-grupo">Atributos</h2></div>
            <div className="elementos-corpo">
              <div className="pentagrama"><Pentagrama valores={f.elementos} /></div>
              <div className="elementos-lista">{R.GRUPOS.elementos.map(i => linhaAttr('elementos', i, true))}</div>
            </div>
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
          <div className="duas-col">
            {([['inventario', 'Inventário'], ['notas', 'Anotações']] as const).map(([k, rotulo]) => (
              <div className="campo" key={k}>
                <label className="rotulo" htmlFor={`c-${k}`}>{rotulo}</label>
                <textarea id={`c-${k}`} value={f[k]} onChange={ev => ed.definir({ ...f, [k]: ev.target.value }, { [k]: ev.target.value })} />
              </div>
            ))}
          </div>
        </section>

        <aside className="col-cena" aria-label="Em cena">
          {blocoVital('vidaAtual', 'Vida', 'cor-vida', f.vidaAtual, vm, `15 + vitalidade ${f.corpo.vitalidade} × 2 = ${vm}`)}
          {blocoVital('manaAtual', 'Mana', 'cor-mana', f.manaAtual, mm,
            `30 + onipotência ${f.mente.onipotencia} × ${virgula(R.TIERS[f.tier])} (tier ${f.tier}) = ${base}${f.manaPerdida ? `, menos ${f.manaPerdida} perdida = ${mm}` : ''}`,
            <label className="perda-perm" htmlFor="c-mana-perdida">
              Mana total perdida para sempre
              <CampoNumero id="c-mana-perdida" min={0} valor={f.manaPerdida} aoMudar={v => mudarComMaximos(c => { c.manaPerdida = R.inteiro(v, 0, 99999); }, c => ({ manaPerdida: c.manaPerdida }))} />
            </label>)}

          <div className="fadiga">
            <div className="vital-topo">
              <label className="vital-rot" htmlFor="v-fadiga">Fadiga mental</label>
              <span className="vital-num"><CampoNumero id="v-fadiga" min={0} max={100} aoVivo valor={f.fadiga} aoMudar={mudarFadiga} /><span>%</span></span>
            </div>
            <input id="r-fadiga" type="range" min={0} max={100} step={1} value={f.fadiga} aria-label="Fadiga mental em porcentagem" onChange={ev => mudarFadiga(ev.target.value)} />
            <ol className="escada">
              {R.ESTAGIOS.map(s => (
                <li key={s.min}>
                  <button type="button" className={`degrau est-${s.min}${s.min <= f.fadiga ? ' passou' : ''}`} aria-current={s.min === e.min ? 'true' : undefined} onClick={() => mudarFadiga(s.min)}>
                    <b>{String(s.min).padStart(2, '0')}%</b>
                    <span className="degrau-nome">{s.nome}</span>
                    {s.txt && <span className="degrau-txt">{s.txt}</span>}
                    {s.perda && <span className="degrau-custo">Ao fim da cena: perde {s.perda}% da mana total</span>}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-forte" onClick={encerrarCena}>{perda ? `Encerrar cena: −${perda} de mana total` : 'Encerrar cena'}</button>
            <ul className="registro">
              {f.registro.slice(0, 3).map(r => <li key={r.em}>{dataCurta(r.em)}: {r.txt}</li>)}
            </ul>
          </div>

        </aside>
      </div>
      <ChatFlutuante
        chat={chat}
        escopo={campanha ? `${campanha.nome}: todos da mesa veem` : 'Só você vê: esta ficha não está em campanha'}
        aoRolar={(lados, bonus) => rolar({ lados, bonus })}
      />
    </article>
  );
}
