'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import EditorFicha from '@/components/EditorFicha';
import { mensagem } from '@/lib/cliente';
import type { Ficha } from '@/lib/tipos';
import { useChat } from '@/lib/useChat';
import { useFichaEditavel } from '@/lib/useFicha';

export default function PaginaFicha() {
  const { id } = useParams<{ id: string }>();
  const ed = useFichaEditavel(id);
  if (ed.erro && !ed.ficha) {
    return (
      <section className="vazio">
        <h2>Não consegui abrir esta ficha</h2>
        <p>{mensagem(ed.erro)}</p>
        <Link className="btn" href="/fichas">Voltar para minhas fichas</Link>
      </section>
    );
  }
  if (!ed.ficha) return <p className="apagado">Abrindo a ficha…</p>;
  return <FichaComChat f={ed.ficha} ed={ed} />;
}

function FichaComChat({ f, ed }: { f: Ficha; ed: ReturnType<typeof useFichaEditavel> }) {
  /* Em campanha, o chat é o da mesa inteira. Fora dela, é só desta ficha. */
  const chat = useChat(f.campanhaId ? `/api/campanhas/${f.campanhaId}/chat` : `/api/fichas/${f.id}/chat`);
  return <EditorFicha f={f} ed={ed} chat={chat} />;
}
