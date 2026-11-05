'use client';
import { useState } from 'react';
import { BotaoConfirmar, CampoNumero } from '@/components/comuns';
import * as R from '@/lib/regras';

const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nomeElemento = (k: string) => R.GRUPOS.elementos.find(([e]) => e === k)?.[1] ?? '';

/* A aba de feitiços da ficha. O custo mostrado já desconta o gasto universal do núcleo. */
export default function Magias({ magias, gastoUniversal, somenteLeitura, aoMudar, aoConjurar }: {
  magias: R.Magia[]; gastoUniversal: number; somenteLeitura: boolean;
  aoMudar: (magias: R.Magia[]) => void; aoConjurar: (m: R.Magia) => void;
}) {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (id: string) => setAbertas(a => {
    const n = new Set(a);
    if (!n.delete(id)) n.add(id);
    return n;
  });
  const mudar = (id: string, campos: Partial<R.Magia>) => aoMudar(magias.map(m => (m.id === id ? { ...m, ...campos } : m)));
  function adicionar() {
    const id = novoId();
    aoMudar([...magias, { id, nome: '', elemento: '', custo: 0, alcance: '', duracao: '', descricao: '' }]);
    setAbertas(a => new Set(a).add(id));
  }

  return (
    <div className="magias">
      <div className="cab-grupo cab-pericias">
        <h2 className="titulo-grupo">Magias</h2>
        {gastoUniversal > 0 && <span className="sp-saldo">Gasto universal: −{gastoUniversal} de mana</span>}
      </div>
      {magias.length === 0 && <p className="apagado">{somenteLeitura ? 'Esta ficha não tem magias.' : 'Nenhuma magia ainda. Adicione o primeiro feitiço desta ficha.'}</p>}
      <ul className="lista-magias">
        {magias.map(m => {
          const aberta = abertas.has(m.id), custo = Math.max(0, m.custo - gastoUniversal), nome = m.nome || 'Magia sem nome', elemento = nomeElemento(m.elemento);
          return (
            <li className={`magia${m.elemento ? ` c-${m.elemento}` : ''}`} key={m.id}>
              <div className="magia-topo">
                <button type="button" className="magia-nome" aria-expanded={aberta} onClick={() => alternar(m.id)}>
                  {m.elemento && <span className="ponto" />}{nome}
                  {elemento && <small>{elemento}</small>}
                </button>
                <span className="magia-custo">{gastoUniversal > 0 && m.custo > 0 ? `${m.custo} − ${gastoUniversal} = ` : ''}<b>{custo}</b> de mana</span>
                <button type="button" className="rolar" aria-label={`Conjurar ${nome}`} onClick={() => aoConjurar(m)}>Conjurar</button>
              </div>
              {aberta && (somenteLeitura ? (
                <div className="magia-corpo">
                  {(m.alcance || m.duracao) && <p className="formula">{[m.alcance && `Alcance: ${m.alcance}`, m.duracao && `Duração: ${m.duracao}`].filter(Boolean).join(' · ')}</p>}
                  <p className="magia-descricao">{m.descricao || 'Sem descrição.'}</p>
                </div>
              ) : (
                <div className="magia-corpo magia-campos">
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`m-nome-${m.id}`}>Nome da magia</label>
                    <input id={`m-nome-${m.id}`} type="text" maxLength={80} value={m.nome} onChange={ev => mudar(m.id, { nome: ev.target.value })} />
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`m-elemento-${m.id}`}>Elemento</label>
                    <select id={`m-elemento-${m.id}`} value={m.elemento} onChange={ev => mudar(m.id, { elemento: ev.target.value })}>
                      <option value="">Nenhum</option>
                      {R.GRUPOS.elementos.map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`m-custo-${m.id}`}>Custo de mana</label>
                    <CampoNumero id={`m-custo-${m.id}`} min={0} valor={m.custo} aoMudar={v => mudar(m.id, { custo: R.inteiro(v, 0, 9999) })} />
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`m-alcance-${m.id}`}>Alcance</label>
                    <input id={`m-alcance-${m.id}`} type="text" maxLength={60} value={m.alcance} onChange={ev => mudar(m.id, { alcance: ev.target.value })} />
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`m-duracao-${m.id}`}>Duração</label>
                    <input id={`m-duracao-${m.id}`} type="text" maxLength={60} value={m.duracao} onChange={ev => mudar(m.id, { duracao: ev.target.value })} />
                  </div>
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`m-descricao-${m.id}`}>Descrição</label>
                    <textarea id={`m-descricao-${m.id}`} maxLength={4000} value={m.descricao} onChange={ev => mudar(m.id, { descricao: ev.target.value })} />
                  </div>
                  <div className="campo-largo">
                    <BotaoConfirmar rotulo="Remover magia" confirmar="Confirmar: remover magia" aoConfirmar={() => aoMudar(magias.filter(o => o.id !== m.id))} />
                  </div>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {!somenteLeitura && magias.length < R.LIMITE_MAGIAS && <button type="button" className="btn" onClick={adicionar}>Adicionar magia</button>}
    </div>
  );
}
