import Link from 'next/link';
import { pct } from '@/lib/cliente';
import type { ResumoFicha } from '@/lib/tipos';
import { Barra, Capitular, PilulaFadiga } from './comuns';

export function CabecalhoRol({ comAcao }: { comAcao?: boolean }) {
  return (
    <div className={`rol-cab rotulo${comAcao ? ' rol-cab-acao' : ''}`} aria-hidden="true">
      <span>Personagem</span><span>Tier</span><span>Vida</span><span>Mana</span><span>Fadiga mental</span>
    </div>
  );
}

export function LinhaFicha({ f, meta }: { f: ResumoFicha; meta: string }) {
  const identidade = (
    <>
      <Capitular nome={f.nome} fichaId={f.id} fotoV={f.fotoV} />
      <span className="rol-id">
        <span className="rol-nome">{f.nome || 'Sem nome'}</span>
        <span className="rol-meta">{meta}</span>
      </span>
    </>
  );
  /* O servidor não envia vida, mana e fadiga de fichas alheias para jogadores: essa linha não abre a ficha. */
  if (!f.completo) {
    return (
      <div className="rol-linha">
        {identidade}
        <span className="rol-oculto">Vida, mana e fadiga: só o mestre e o dono veem.</span>
      </div>
    );
  }
  return (
    <Link className="rol-linha" href={`/fichas/${f.id}`}>
      {identidade}
      <span className="rol-tier" aria-label={`Tier ${f.tier}`}>{f.tier}</span>
      <span className="medida rol-vida cor-vida">
        <span className="medida-num"><span className="medida-rot">Vida </span><b>{f.vidaAtual}</b> <span>/ {f.vidaMax}</span></span>
        <Barra valor={pct(f.vidaAtual!, f.vidaMax!)} />
      </span>
      <span className="medida cor-mana">
        <span className="medida-num"><span className="medida-rot">Mana </span><b>{f.manaAtual}</b> <span>/ {f.manaMax}</span></span>
        <Barra valor={pct(f.manaAtual!, f.manaMax!)} />
      </span>
      <span className="rol-fadiga"><PilulaFadiga fadiga={f.fadiga!} /></span>
    </Link>
  );
}
