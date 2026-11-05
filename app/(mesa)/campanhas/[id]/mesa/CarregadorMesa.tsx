'use client';
import dynamic from 'next/dynamic';

/* O PixiJS e o socket só existem no navegador. */
const MesaCliente = dynamic(() => import('@mesa/features/rooms/MesaCliente').then(m => m.MesaCliente), {
  ssr: false,
  loading: () => <div className="map-loading">Preparando a mesa…</div>,
});

export default function CarregadorMesa({ campanha }: { campanha: { id: string; nome: string } }) {
  return <MesaCliente campanha={campanha} />;
}
