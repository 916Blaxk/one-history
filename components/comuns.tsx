'use client';
import { useEffect, useRef, useState } from 'react';
import { urlFoto } from '@/lib/cliente';
import { estagio } from '@/lib/regras';

export function Capitular({ nome, fichaId, fotoV, className = '' }: { nome: string; fichaId?: string; fotoV?: number; className?: string }) {
  const imagem = fichaId && fotoV ? urlFoto(fichaId, fotoV) : null;
  return (
    <span className={`capitular ${className}`}>
      {imagem
        ? <img src={imagem} alt={`Foto de ${nome || 'personagem sem nome'}`} />
        : (nome.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

export function Barra({ valor }: { valor: number }) {
  return <span className="barra"><i style={{ width: `${valor}%` }} /></span>;
}

export function PilulaFadiga({ fadiga }: { fadiga: number }) {
  const e = estagio(fadiga);
  return <span className={`pilula est-${e.min}`}><span className="pilula-pct">{fadiga}%</span> {e.nome}</span>;
}

/* Ação sem volta: o primeiro clique arma, o segundo confirma. Desarma sozinho depois de alguns segundos. */
export function BotaoConfirmar({ rotulo, confirmar, aoConfirmar, className = 'btn', disabled }: {
  rotulo: string; confirmar: string; aoConfirmar: () => void; className?: string; disabled?: boolean;
}) {
  const [armado, setArmado] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" disabled={disabled} className={`${className}${armado ? ' btn-perigo' : ''}`} onClick={() => {
      if (armado) { clearTimeout(t.current); setArmado(false); aoConfirmar(); return; }
      setArmado(true);
      t.current = setTimeout(() => setArmado(false), 4000);
    }}>
      {armado ? confirmar : rotulo}
    </button>
  );
}

/* Campo numérico que não briga com quem digita: enquanto tem foco, mostra o que está sendo digitado.
   Com `aoVivo`, avisa a cada tecla. Sem ele, só ao sair do campo, para "12" não passar por "1" e cortar a vida atual. */
export function CampoNumero({ valor, aoMudar, aoVivo, ...resto }: {
  valor: number; aoMudar: (v: string) => void; aoVivo?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <input
      {...resto}
      type="number"
      inputMode="numeric"
      value={rascunho ?? valor}
      onFocus={e => { setRascunho(String(valor)); e.target.select(); }}
      onChange={e => { setRascunho(e.target.value); if (aoVivo) aoMudar(e.target.value); }}
      onBlur={() => { if (rascunho !== null && !aoVivo) aoMudar(rascunho); setRascunho(null); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
