import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import '@/app/globals.css';
import FormularioEntrar from '@/components/FormularioEntrar';
import { CORES_NUCLEO, NUCLEOS } from '@/lib/regras';
import { usuarioDaSessao } from '@/lib/servidor/sessao';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Entrar' };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const { destino } = await searchParams;
  /* Só aceita caminho deste site: um link malicioso não pode mandar a pessoa para fora depois do login. */
  const seguro = destino && /^\/(?![/\\])/.test(destino) ? destino : '/fichas';
  if (await usuarioDaSessao()) redirect(seguro);
  return (
    <main className="entrada">
      <div>
        <p className="entrada-sobre">Sistema de RPG</p>
        <h1 className="marca">One History</h1>
        {/* As treze etapas do núcleo: a progressão que todo personagem percorre, do vermelho escuro ao branco. */}
        <figure className="escala-nucleo" aria-label={`Etapas do núcleo, de ${NUCLEOS[0].nome.toLowerCase()} a ${NUCLEOS[NUCLEOS.length - 1].nome.toLowerCase()}`}>
          <ol>{CORES_NUCLEO.map((cor, i) => <li key={cor} style={{ background: cor }} title={NUCLEOS[i].nome} />)}</ol>
          <figcaption><span>{NUCLEOS[0].nome}</span><span>Núcleo</span><span>{NUCLEOS[NUCLEOS.length - 1].nome}</span></figcaption>
        </figure>
        <p className="entrada-texto">Fichas e campanhas para a sua mesa de RPG, com vida, mana e fadiga mental calculadas pelas regras do sistema.</p>
        <ul className="entrada-lista">
          <li>Crie personagens e guarde tudo na sua conta.</li>
          <li>Abra uma campanha e chame os jogadores com um código.</li>
          <li>Como mestre, acompanhe a mesa inteira e as rolagens ao vivo.</li>
        </ul>
      </div>
      <FormularioEntrar destino={seguro} convite={seguro.startsWith('/convite/')} />
    </main>
  );
}
