'use client';
import { useState } from 'react';
import { BotaoConfirmar } from '@/components/comuns';
import * as R from '@/lib/regras';

const novoId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NOME_ATRIBUTO: Record<R.AtributoArma, string> = { destreza: 'Destreza', tracao: 'Tração' };

/* A aba de armas da ficha. O ataque é a perícia Combate, com a vantagem do atributo da arma. */
export default function Armas({ armas, ataque, aoMudar, aoAtacar, aoRolarDano }: {
  armas: R.Arma[]; ataque: (a: R.Arma) => string;
  aoMudar: (armas: R.Arma[]) => void; aoAtacar: (a: R.Arma) => void; aoRolarDano: (a: R.Arma) => void;
}) {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (id: string) => setAbertas(a => {
    const n = new Set(a);
    if (!n.delete(id)) n.add(id);
    return n;
  });
  const mudar = (id: string, campos: Partial<R.Arma>) => aoMudar(armas.map(a => {
    if (a.id !== id) return a;
    const nova = { ...a, ...campos };
    /* Leve e pesada têm o atributo fixo: guardar o certo evita mostrar um atributo que não vale. */
    return { ...nova, atributo: R.atributoDaArma(nova) };
  }));
  function adicionar() {
    const id = novoId();
    aoMudar([...armas, { id, nome: '', categoria: 'leve', atributo: 'destreza', dano: '', descricao: '' }]);
    setAbertas(a => new Set(a).add(id));
  }

  return (
    <div className="magias">
      <div className="cab-grupo cab-pericias">
        <h2 className="titulo-grupo">Armas</h2>
      </div>
      <p className="grupo-desc">O ataque rola a perícia Combate. Arma leve usa Destreza, pesada usa Tração, e a média usa o atributo escolhido.</p>
      {armas.length === 0 && <p className="apagado">Nenhuma arma ainda. Adicione a primeira arma desta ficha.</p>}
      <ul className="lista-magias">
        {armas.map(a => {
          const aberta = abertas.has(a.id), nome = a.nome || 'Arma sem nome';
          const categoria = R.CATEGORIAS_ARMA.find(([k]) => k === a.categoria)?.[1] ?? '';
          return (
            <li className="magia arma" key={a.id}>
              <div className="magia-topo">
                <button type="button" className="magia-nome" aria-expanded={aberta} onClick={() => alternar(a.id)}>
                  {nome}
                  <small>{categoria} · {NOME_ATRIBUTO[R.atributoDaArma(a)]}</small>
                </button>
                <span className="magia-custo">Ataque: <b>{ataque(a)}</b>{a.dano && <small>Dano: <b>{a.dano}</b></small>}</span>
                <span className="arma-botoes">
                  <button type="button" className="rolar" aria-label={`Atacar com ${nome}`} onClick={() => aoAtacar(a)}>Atacar</button>
                  {a.dano.trim() && <button type="button" className="rolar" aria-label={`Rolar dano de ${nome}`} onClick={() => aoRolarDano(a)}>Dano</button>}
                </span>
              </div>
              {aberta && (
                <div className="magia-corpo magia-campos">
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`a-nome-${a.id}`}>Nome da arma</label>
                    <input id={`a-nome-${a.id}`} type="text" maxLength={80} value={a.nome} onChange={ev => mudar(a.id, { nome: ev.target.value })} />
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`a-categoria-${a.id}`}>Categoria</label>
                    <select id={`a-categoria-${a.id}`} value={a.categoria} onChange={ev => mudar(a.id, { categoria: ev.target.value as R.CategoriaArma })}>
                      {R.CATEGORIAS_ARMA.map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`a-atributo-${a.id}`}>Atributo</label>
                    {/* Só a arma média deixa escolher: as outras mostram o atributo fixo. */}
                    <select id={`a-atributo-${a.id}`} value={R.atributoDaArma(a)} disabled={a.categoria !== 'media'} onChange={ev => mudar(a.id, { atributo: ev.target.value as R.AtributoArma })}>
                      <option value="destreza">Destreza</option>
                      <option value="tracao">Tração</option>
                    </select>
                  </div>
                  <div className="campo">
                    <label className="rotulo" htmlFor={`a-dano-${a.id}`}>Dano</label>
                    <input id={`a-dano-${a.id}`} type="text" maxLength={40} placeholder="Ex.: 1d8+2" value={a.dano} onChange={ev => mudar(a.id, { dano: ev.target.value })} />
                  </div>
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`a-descricao-${a.id}`}>Descrição</label>
                    <textarea id={`a-descricao-${a.id}`} maxLength={4000} value={a.descricao} onChange={ev => mudar(a.id, { descricao: ev.target.value })} />
                  </div>
                  <div className="campo-largo">
                    <BotaoConfirmar rotulo="Remover arma" confirmar="Confirmar: remover arma" aoConfirmar={() => aoMudar(armas.filter(o => o.id !== a.id))} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {armas.length < R.LIMITE_ARMAS && <button type="button" className="btn" onClick={adicionar}>Adicionar arma</button>}
    </div>
  );
}
