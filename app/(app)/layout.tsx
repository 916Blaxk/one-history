import IrParaEntrar from '@/components/IrParaEntrar';
import Navegacao from '@/components/Navegacao';
import { usuarioDaSessao } from '@/lib/servidor/sessao';

export const dynamic = 'force-dynamic';

export default async function LayoutLogado({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioDaSessao();
  if (!usuario) return <IrParaEntrar />;
  return (
    <>
      <Navegacao nome={usuario.nome} />
      <main className="folio">{children}</main>
    </>
  );
}
