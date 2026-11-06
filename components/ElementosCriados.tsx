'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { BotaoConfirmar, CampoNumero } from '@/components/comuns';
import * as R from '@/lib/regras';

const novoId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nomeBase = (k: string) => R.GRUPOS.elementos.find(([e]) => e === k)?.[1] ?? '';

/* A cor conta de onde o elemento veio: a variação herda a da origem, e a fusão mistura as duas. */
export function PontoElemento({ origens }: { origens: readonly string[] }) {
  const [a, b] = origens;
  return <span className="ponto" style={{ background: b ? `linear-gradient(135deg,var(--${a}) 50%,var(--${b}) 50%)` : `var(--${a})` }} />;
}

export function origemDoElemento(e: Pick<R.ElementoCriado, 'tipo' | 'origens'>) {
  return e.tipo === 'fusao' ? `Fusão de ${nomeBase(e.origens[0]!)} e ${nomeBase(e.origens[1]!)}` : `Variação de ${nomeBase(e.origens[0]!)}`;
}

export default function ElementosCriados({ f, souMestre, editandoLimites, aoMudar, aoMudarLimite, aoRolar }: {
  f: R.DadosFicha; souMestre: boolean; editandoLimites: boolean;
  aoMudar: (lista: R.ElementoCriado[]) => void;
  aoMudarLimite: (chave: string, valor: string) => void;
  aoRolar: (atributo: string) => void;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<R.ElementoCriado['tipo']>('variacao');
  const [origemA, setOrigemA] = useState<string>(R.GRUPOS.elementos[0][0]);
  const [origemB, setOrigemB] = useState<string>(R.GRUPOS.elementos[1][0]);
  const lista = f.elementosCriados;

  function criar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) { toast.error('Dê um nome ao elemento.'); return; }
    if (tipo === 'fusao' && origemA === origemB) { toast.error('A fusão precisa de dois elementos diferentes.'); return; }
    aoMudar([...lista, { id: novoId(), nome: nome.trim(), tipo, origens: tipo === 'fusao' ? [origemA, origemB] : [origemA], valor: 0 }]);
    setNome('');
    setCriando(false);
  }
  function mudarValor(e: R.ElementoCriado, pedido: unknown) {
    let valor = R.inteiro(pedido, 0, 999);
    const limite = f.limites[R.chaveCriado(e.id)];
    if (!souMestre && limite !== undefined && valor > e.valor && valor > limite) {
      valor = Math.max(e.valor, limite);
      toast.error('Esse valor passa do limite do mestre.');
    }
    aoMudar(lista.map(o => (o.id === e.id ? { ...o, valor } : o)));
  }

  return (
    <div className="elementos-criados">
      {lista.map(e => {
        const chave = R.chaveCriado(e.id), limite = f.limites[chave], idCampo = `a-criado-${e.id}`;
        return (
          <div className="attr" key={e.id}>
            <label htmlFor={idCampo}><PontoElemento origens={e.origens} />{e.nome}<small>{origemDoElemento(e)}</small>{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
            <div className="passo">
              <button type="button" aria-label={`Diminuir ${e.nome}`} onClick={() => mudarValor(e, e.valor - 1)}>−</button>
              <CampoNumero id={idCampo} min={0} valor={e.valor} aoMudar={v => mudarValor(e, v)} />
              <button type="button" disabled={!souMestre && limite !== undefined && e.valor >= limite} aria-label={`Aumentar ${e.nome}`} onClick={() => mudarValor(e, e.valor + 1)}>+</button>
            </div>
            <button type="button" className="rolar" title={`Rolar d20 + ${e.nome}`} aria-label={`Rolar d20 mais ${e.nome}`} onClick={() => aoRolar(`criados.${e.id}`)}>d20</button>
            <div className="elemento-remover">
              <BotaoConfirmar className="btn btn-pequeno" rotulo={`Remover ${e.nome}`} confirmar="Confirmar: remover" aoConfirmar={() => aoMudar(lista.filter(o => o.id !== e.id))} />
            </div>
            {souMestre && editandoLimites && (
              <label className="campo-limite">
                Limite de {e.nome}
                <input type="number" inputMode="numeric" min={0} max={999} placeholder="Sem limite" value={limite ?? ''} onChange={ev => aoMudarLimite(chave, ev.target.value)} />
              </label>
            )}
          </div>
        );
      })}
      {criando ? (
        <form className="elemento-form" onSubmit={criar}>
          <div className="campo">
            <label className="rotulo" htmlFor="novo-elemento-nome">Nome do elemento</label>
            <input id="novo-elemento-nome" type="text" maxLength={R.TAMANHO_NOME_ELEMENTO} autoFocus value={nome} onChange={ev => setNome(ev.target.value)} />
          </div>
          <div className="campo">
            <label className="rotulo" htmlFor="novo-elemento-tipo">Tipo</label>
            <select id="novo-elemento-tipo" value={tipo} onChange={ev => setTipo(ev.target.value as R.ElementoCriado['tipo'])}>
              <option value="variacao">Variação de um elemento</option>
              <option value="fusao">Fusão de dois elementos</option>
            </select>
          </div>
          <div className="campo">
            <label className="rotulo" htmlFor="novo-elemento-origem">{tipo === 'fusao' ? 'Primeiro elemento' : 'Elemento de origem'}</label>
            <select id="novo-elemento-origem" value={origemA} onChange={ev => setOrigemA(ev.target.value)}>
              {R.GRUPOS.elementos.map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
            </select>
          </div>
          {tipo === 'fusao' && (
            <div className="campo">
              <label className="rotulo" htmlFor="novo-elemento-origem-2">Segundo elemento</label>
              <select id="novo-elemento-origem-2" value={origemB} onChange={ev => setOrigemB(ev.target.value)}>
                {R.GRUPOS.elementos.map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>)}
              </select>
            </div>
          )}
          <div className="acoes">
            <button type="submit" className="btn btn-forte">Salvar elemento</button>
            <button type="button" className="btn" onClick={() => setCriando(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        lista.length < R.LIMITE_ELEMENTOS_CRIADOS && <button type="button" className="btn btn-pequeno elemento-criar" onClick={() => setCriando(true)}>+ Criar elemento</button>
      )}
    </div>
  );
}
