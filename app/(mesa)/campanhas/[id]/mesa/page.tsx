import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import IrParaEntrar from '@/components/IrParaEntrar';
import { db } from '@/lib/servidor/db';
import { campanhas, membros } from '@/lib/servidor/schema';
import { usuarioDaSessao } from '@/lib/servidor/sessao';
import '@mesa/styles/mesa.css';
import CarregadorMesa from './CarregadorMesa';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mesa' };

export default async function PaginaMesa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioDaSessao();
  if (!usuario) return <IrParaEntrar />;
  const [linha] = await db.select({ nome: campanhas.nome }).from(membros)
    .innerJoin(campanhas, eq(membros.campanhaId, campanhas.id))
    .where(and(eq(membros.campanhaId, id), eq(membros.usuarioId, usuario.id)));
  /* A mesma resposta para campanha inexistente e para quem não participa: a existência dela não vaza. */
  if (!linha) {
    return (
      <main className="map-loading" role="alert">
        Campanha não encontrada, ou você não participa dela.
      </main>
    );
  }
  return <CarregadorMesa campanha={{ id, nome: linha.nome }} />;
}
