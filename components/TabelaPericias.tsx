'use client';
import { useState } from 'react';
import { CampoNumero } from '@/components/comuns';
import * as R from '@/lib/regras';

const SIGLA: Record<R.AtributoPericia, string> = { destreza: 'DES', tracao: 'TRA', onisciencia: 'ONC', onipotencia: 'ONP', encanto: 'ENC' };
const NOME_ATRIBUTO = Object.fromEntries([...R.GRUPOS.corpo, ...R.GRUPOS.mente].map(([k, rotulo]) => [k, rotulo])) as Record<string, string>;
const TODAS = 'Todas';

function IconeD20() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M16 2 28.500 9v14L16 30 3.500 23V9z" />
      <path d="M16 9 23.500 21h-15zM16 2v7M3.500 9 16 9l12.500 0M3.500 23l5-2-5-12M28.500 23l-5-2 5-12M16 30l-7.500-9M16 30l7.500-9" />
    </svg>
  );
}

/* Uma tabela só, em ordem alfabética, para achar a perícia sem abrir categorias. A classe vira um filtro opcional. */
export default function TabelaPericias({ f, souMestre, editandoLimites, aoMudarTreino, aoMudarOutros, aoMudarLimite, aoRolar }: {
  f: R.DadosFicha; souMestre: boolean; editandoLimites: boolean;
  aoMudarTreino: (k: string, v: unknown) => void;
  aoMudarOutros: (k: string, v: unknown) => void;
  aoMudarLimite: (chave: string, v: string) => void;
  aoRolar: (k: string) => void;
}) {
  const [classe, setClasse] = useState(TODAS);
  const itens = R.PERICIAS.filter(c => classe === TODAS || c.categoria === classe).flatMap(c => c.itens)
    .slice().sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

  return (
    <div className="pericias">
      <select className="pericias-filtro" aria-label="Filtrar perícias" value={classe} onChange={ev => setClasse(ev.target.value)}>
        <option value={TODAS}>Todas as perícias</option>
        {R.PERICIAS.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
      </select>
      <div className="pericia-linha pericia-cab" aria-hidden="true">
        <span /><span>Perícia</span><span>Dados</span><span>Bônus</span><span>Treino</span><span>Outros</span>
      </div>
      <ul>
        {itens.map(([k, rotulo, desc]) => {
          const treino = f.pericias[k]!, outros = f.periciasOutros[k] ?? 0, chave = R.chaveLimite('pericias', k), limite = f.limites[chave];
          const atributo = R.ATRIBUTO_DA_PERICIA[k], vantagem = R.vantagemDaRolagem(f, 'pericias', k);
          const idCampo = `a-pericias-${k}`;
          return (
            <li className="pericia-linha" data-treinada={treino > 0} key={k}>
              <button type="button" className="pericia-rolar" title={`Rolar ${vantagem ? `${vantagem + 1}d20, fica o maior,` : 'd20'} + ${treino + outros}`} aria-label={`Rolar d20 mais ${rotulo}`} onClick={() => aoRolar(k)}><IconeD20 /></button>
              <label className="pericia-nome" htmlFor={idCampo} title={desc}>{rotulo}{limite !== undefined && !editandoLimites && <small>Máx. {limite}</small>}</label>
              <span className="pericia-dados" data-vantagem={vantagem > 0} title={atributo ? `${NOME_ATRIBUTO[atributo]}: ${vantagem} de vantagem (1 a cada ${R.PONTOS_POR_VANTAGEM} pontos)` : 'Sem atributo definido'}>( {atributo ? SIGLA[atributo] : '—'}{vantagem > 0 && ` +${vantagem}`} )</span>
              <span className="pericia-bonus" aria-label={`Bônus de ${rotulo}: ${treino + outros}`}>( {treino + outros} )</span>
              <CampoNumero id={idCampo} min={0} valor={treino} aoMudar={v => aoMudarTreino(k, v)} />
              <CampoNumero aria-label={`Outros de ${rotulo}`} min={0} valor={outros} aoMudar={v => aoMudarOutros(k, v)} />
              {souMestre && editandoLimites && (
                <label className="campo-limite">
                  Limite de {rotulo}
                  <input type="number" inputMode="numeric" min={0} max={999} placeholder="Sem limite" value={limite ?? ''} onChange={ev => aoMudarLimite(chave, ev.target.value)} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
