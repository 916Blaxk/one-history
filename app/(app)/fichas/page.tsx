'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CabecalhoRol, LinhaFicha } from '@/components/LinhaFicha';
import { api, buscar, mensagem } from '@/lib/cliente';
import { manaMax, vidaMax } from '@/lib/regras';
import type { Ficha, ResumoFicha } from '@/lib/tipos';

const resumir = (f: Ficha): ResumoFicha => ({
  id: f.id, nome: f.nome, raca: f.raca, fotoV: f.fotoV, donoId: f.donoId, donoNome: f.contexto.donoNome, completo: true,
  estilo: f.estilo, tier: f.tier, fadiga: f.fadiga, vidaAtual: f.vidaAtual, vidaMax: vidaMax(f), manaAtual: f.manaAtual, manaMax: manaMax(f),
});

export default function PaginaFichas() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<{ fichas: Ficha[] }>('/api/fichas', buscar);
  const [filtro, setFiltro] = useState('');
  const [criando, setCriando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const fichas = data?.fichas ?? [];
  const q = filtro.trim().toLowerCase();
  const visiveis = q ? fichas.filter(f => [f.nome, f.player, f.raca, f.estilo].join(' ').toLowerCase().includes(q)) : fichas;
  const graves = fichas.filter(f => f.fadiga >= 60).length;

  async function nova() {
    setCriando(true);
    try {
      const { ficha } = await api<{ ficha: Ficha }>('POST', '/api/fichas');
      router.push(`/fichas/${ficha.id}`);
    } catch (e) {
      toast.error(mensagem(e));
      setCriando(false);
    }
  }
  async function exportar() {
    try {
      const dados = await api('GET', '/api/fichas/exportar');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
      a.download = 'one-history-fichas.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { toast.error(mensagem(e)); }
  }
  async function importar(arq: File) {
    let lista: unknown[];
    try {
      const o = JSON.parse(await arq.text());
      lista = Array.isArray(o) ? o : o.fichas;
      if (!Array.isArray(lista)) throw 0;
    } catch {
      toast.error('Esse arquivo não é uma exportação do One History. Escolha o .json gerado em Exportar fichas.');
      return;
    }
    let certas = 0;
    let ultimoErro = '';
    for (const dados of lista) {
      try { await api('POST', '/api/fichas', { dados }); certas++; }
      catch (e) { ultimoErro = mensagem(e); }
    }
    await mutate();
    if (certas === lista.length) toast.success(`${certas} ${certas === 1 ? 'ficha importada' : 'fichas importadas'}.`);
    else toast.error(`Importei ${certas} de ${lista.length} fichas. Motivo: ${ultimoErro}`);
  }

  return (
    <>
      <header className="pag-topo">
        <div>
          <h1 className="pag-titulo">Minhas fichas</h1>
          <p className="pag-sub">
            {isLoading ? 'Abrindo suas fichas…' : `${fichas.length} ${fichas.length === 1 ? 'personagem' : 'personagens'}`}
            {graves > 0 && <> · <strong>{graves} com fadiga de 60% ou mais</strong></>}
          </p>
        </div>
        <div className="acoes">
          <button type="button" className="btn" onClick={exportar}>Exportar fichas</button>
          <button type="button" className="btn" onClick={() => arquivo.current?.click()}>Importar</button>
          <button type="button" className="btn btn-forte" disabled={criando} onClick={nova}>Nova ficha</button>
          <input ref={arquivo} id="importar" type="file" accept=".json,application/json" hidden onChange={e => {
            const a = e.target.files?.[0];
            e.target.value = '';
            if (a) importar(a);
          }} />
        </div>
      </header>

      {fichas.length > 0 && (
        <input id="busca" className="busca" type="search" placeholder="Buscar por personagem, jogador ou raça" aria-label="Buscar fichas" value={filtro} onChange={e => setFiltro(e.target.value)} />
      )}

      {!isLoading && fichas.length === 0 && (
        <section className="vazio">
          <h2>Nenhum personagem ainda</h2>
          <p>Cada ficha guarda atributos, armas, vida, mana e fadiga mental. Depois de criar, você pode levar a ficha para uma campanha.</p>
          <button type="button" className="btn btn-forte" disabled={criando} onClick={nova}>Criar a primeira ficha</button>
        </section>
      )}
      {fichas.length > 0 && visiveis.length === 0 && <section className="vazio"><p>Nenhuma ficha combina com “{filtro}”.</p></section>}
      {visiveis.length > 0 && (
        <>
          <CabecalhoRol />
          <ul>
            {visiveis.map(f => (
              <li className="rol-item" key={f.id}>
                <LinhaFicha f={resumir(f)} meta={[f.raca, f.estilo, f.contexto.campanha && `Campanha: ${f.contexto.campanha.nome}`].filter(Boolean).join(' · ') || 'Ficha em branco'} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
