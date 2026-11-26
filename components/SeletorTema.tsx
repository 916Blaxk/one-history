'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { TEMAS, useTema } from '@/lib/tema';

/* Botão de tema no topo. Abre uma lista curta com as três cores do site. */
export default function SeletorTema() {
  const [tema, setTema] = useTema();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);

  return (
    <div className="tema" ref={caixa}>
      <button type="button" className="tema-botao" aria-expanded={aberto} aria-haspopup="true" aria-label="Trocar o tema do site" title="Tema" onClick={() => setAberto(a => !a)}>
        <Palette aria-hidden="true" />
        <span className="tema-botao-texto">Tema</span>
      </button>
      {aberto && (
        <div className="tema-menu" role="menu" aria-label="Temas">
          {TEMAS.map(t => (
            <button
              key={t.id} type="button" role="menuitemradio" aria-checked={tema === t.id} className="tema-opcao"
              style={{ '--a': t.cores[0], '--b': t.cores[1] } as React.CSSProperties}
              onClick={() => { setTema(t.id); setAberto(false); }}
            >
              <span className="tema-amostra" aria-hidden="true" />
              <span className="tema-nome">{t.nome}<small>{t.desc}</small></span>
              {tema === t.id && <Check className="tema-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
