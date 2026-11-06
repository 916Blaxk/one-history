'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollText, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { api, mensagem } from '@/lib/cliente';

export default function Navegacao({ nome }: { nome: string }) {
  const caminho = usePathname();
  const atual = (p: string) => (caminho.startsWith(p) ? 'page' : undefined);
  return (
    <nav className="topo" aria-label="Principal">
      <div className="topo-int">
        <Link href="/fichas" className="topo-marca">One History</Link>
        {/* No celular, estes dois viram a barra inferior, ao alcance do polegar. */}
        <div className="topo-abas">
          <Link href="/fichas" className="topo-link" aria-current={atual('/fichas')}><ScrollText aria-hidden="true" />Minhas fichas</Link>
          <Link href="/campanhas" className="topo-link" aria-current={atual('/campanhas')}><Swords aria-hidden="true" />Campanhas</Link>
        </div>
        <span className="topo-espaco" />
        <Link href="/conta" className="topo-link" aria-current={atual('/conta')}>{nome}</Link>
        <button type="button" className="topo-sair" onClick={async () => {
          try {
            await api('POST', '/api/conta/sair');
            window.location.assign('/entrar');
          } catch (e) { toast.error(mensagem(e)); }
        }}>Sair</button>
      </div>
    </nav>
  );
}
