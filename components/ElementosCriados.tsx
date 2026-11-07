'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { BotaoConfirmar, CampoNumero } from '@/components/comuns';
import * as R from '@/lib/regras';

const novoId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nomeOrigem = (k: string, criados: readonly R.ElementoCriado[]) =>
  R.GRUPOS.elementos.find(([e]) => e === k)?.[1] ?? criados.find(e => e.id === k)?.nome ?? '';

/* A cor conta de onde o elemento veio: a variação herda a da origem, e a fusão mistura os elementos base por trás dela. */
export function PontoElemento({ e, criados }: { e: R.ElementoCriado; criados: readonly R.ElementoCriado[] }) {
  const cores = R.basesDoElemento(e.id, criados);
  const faixas = cores.map((c, i) => `var(--${c}) ${i / cores.length * 100}% ${(i + 1) / cores.length * 100}%`);
  return <span className="ponto" style={{ background: cores.length > 1 ? `linear-gradient(135deg,${faixas.join(',')})` : `var(--${cores[0]})` }} />;
}

export function origemDoElemento(e: Pick<R.ElementoCriado, 'tipo' | 'origens'>, criados: readonly R.ElementoCriado[]) {
  return e.tipo === 'fusao' ? `Fusão de ${nomeOrigem(e.origens[0]!, criados)} e ${nomeOrigem(e.origens[1]!, criados)}` : `Variação de ${nomeOrigem(e.origens[0]!, criados)}`;
}

export default function ElementosCriados({ f, editandoLimites, aoMudar, aoMudarLimite, aoRolar }: {
  f: R.DadosFicha; editandoLimites: boolean;
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

  function remover(e: R.ElementoCriado) {
    /* Sem a origem, o elemento derivado deixaria de valer e sumiria da ficha junto, com o valor dele. */
    const derivado = lista.find(o => o.origens.includes(e.id));
    if (derivado) { toast.error(`${e.nome} faz parte de ${derivado.nome}. Remova ${derivado.nome} primeiro.`); return; }
    aoMudar(lista.filter(o => o.id !== e.id));
  }
  const opcoesBase = R.GRUPOS.elementos.map(([k, rotulo]) => <option key={k} value={k}>{rotulo}</option>);
  const opcoesOrigem = lista.length === 0 ? opcoesBase : (
    <>
      <optgroup label="Elementos base">{opcoesBase}</optgroup>
      <optgroup label="Criados nesta ficha">{lista.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</optgroup>
    </>
  );

  function criar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nome.trim()) { toast.error('Dê um nome ao elemento.'); return; }
    if (tipo === 'fusao' && origemA === origemB) { toast.error('A fusão precisa de dois elementos diferentes.'); return; }
    aoMudar([...lista, { id: novoId(), nome: nome.trim(), tipo, origens: tipo === 'fusao' ? [origemA, origemB] : [origemA], valor: 0 }]);
    setNome('');
    setCriando(false);
  }
  function mudarValor(e: R.ElementoCriado, pedido: unknown) {
    const valor = R.inteiro(pedido, 0, 999);
    aoMudar(lista.map(o => (o.id === e.id ? { ...o, valor } : o)));
  }

  return (
    <div className="elementos-criados">
      {lista.map(e => {
        const chave = R.chaveCriado(e.id), limite = f.limites[chave], idCampo = `a-criado-${e.id}`;
        return (
          <div className="attr" data-acima={limite !== undefined && e.valor > limite} key={e.id}>
            <label htmlFor={idCampo}><PontoElemento e={e} criados={lista} />{e.nome}<small>{origemDoElemento(e, lista)}</small>{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
            <div className="passo">
              <button type="button" aria-label={`Diminuir ${e.nome}`} onClick={() => mudarValor(e, e.valor - 1)}>−</button>
              <CampoNumero id={idCampo} min={0} valor={e.valor} aoMudar={v => mudarValor(e, v)} />
              <button type="button" aria-label={`Aumentar ${e.nome}`} onClick={() => mudarValor(e, e.valor + 1)}>+</button>
            </div>
            <button type="button" className="rolar" title={`Rolar ${R.vantagemDosPontos(e.valor) ? `${R.vantagemDosPontos(e.valor) + 1}d20, fica o maior` : 'd20'}${R.somaDosPontos(e.valor) ? `, + ${R.somaDosPontos(e.valor)}` : ''}`} aria-label={`Rolar d20 mais ${e.nome}`} onClick={() => aoRolar(`criados.${e.id}`)}>d20</button>
            <div className="elemento-remover">
              <BotaoConfirmar className="btn btn-pequeno" rotulo={`Remover ${e.nome}`} confirmar="Confirmar: remover" aoConfirmar={() => remover(e)} />
            </div>
            {editandoLimites && (
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
              {opcoesOrigem}
            </select>
          </div>
          {tipo === 'fusao' && (
            <div className="campo">
              <label className="rotulo" htmlFor="novo-elemento-origem-2">Segundo elemento</label>
              <select id="novo-elemento-origem-2" value={origemB} onChange={ev => setOrigemB(ev.target.value)}>
                {opcoesOrigem}
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
