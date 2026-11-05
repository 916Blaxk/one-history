import type { Metadata } from 'next';
import FichaEmbutida from '@/components/FichaEmbutida';
import { lerOrigens } from '@/lib/integracao';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ficha embutida', robots: { index: false } };

export default async function PaginaFichaEmbutida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="folio">
      <FichaEmbutida id={id} origens={lerOrigens(process.env.ORIGENS_TABLEBOLA)} />
    </main>
  );
}
