'use client';
import { useState } from 'react';
import { BotaoConfirmar } from '@/components/comuns';
import * as R from '@/lib/regras';

const novoId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* Habilidades são texto livre: o jogador descreve o que o personagem sabe fazer, e nenhuma conta depende delas. */
export default function Habilidades({ habilidades, aoMudar }: { habilidades: R.Habilidade[]; aoMudar: (lista: R.Habilidade[]) => void }) {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (id: string) => setAbertas(a => {
    const n = new Set(a);
    if (!n.delete(id)) n.add(id);
    return n;
  });
  const mudar = (id: string, campos: Partial<R.Habilidade>) => aoMudar(habilidades.map(h => (h.id === id ? { ...h, ...campos } : h)));
  function criar() {
    const id = novoId();
    aoMudar([...habilidades, { id, nome: '', descricao: '' }]);
    setAbertas(a => new Set(a).add(id));
  }

  return (
    <div className="habilidades">
      <div className="cab-grupo"><h2 className="titulo-grupo">Habilidades</h2></div>
      {habilidades.length === 0 && <p className="apagado">Nenhuma habilidade ainda. Crie a primeira e descreva o que o personagem sabe fazer.</p>}
      <ul className="lista-magias">
        {habilidades.map(h => {
          const aberta = abertas.has(h.id), nome = h.nome || 'Habilidade sem nome';
          return (
            <li className="magia" key={h.id}>
              <div className="magia-topo habilidade-topo">
                <button type="button" className="magia-nome" aria-expanded={aberta} onClick={() => alternar(h.id)}>{nome}</button>
              </div>
              {aberta ? (
                <div className="magia-corpo magia-campos">
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`h-nome-${h.id}`}>Nome da habilidade</label>
                    <input id={`h-nome-${h.id}`} type="text" maxLength={80} value={h.nome} onChange={ev => mudar(h.id, { nome: ev.target.value })} />
                  </div>
                  <div className="campo campo-largo">
                    <label className="rotulo" htmlFor={`h-descricao-${h.id}`}>O que ela faz</label>
                    <textarea id={`h-descricao-${h.id}`} maxLength={4000} value={h.descricao} onChange={ev => mudar(h.id, { descricao: ev.target.value })} />
                  </div>
                  <div className="campo-largo">
                    <BotaoConfirmar rotulo="Remover habilidade" confirmar="Confirmar: remover habilidade" aoConfirmar={() => aoMudar(habilidades.filter(o => o.id !== h.id))} />
                  </div>
                </div>
              ) : h.descricao && <p className="magia-corpo magia-descricao">{h.descricao}</p>}
            </li>
          );
        })}
      </ul>
      {habilidades.length < R.LIMITE_HABILIDADES && <button type="button" className="btn" onClick={criar}>Criar habilidade</button>}
    </div>
  );
}
