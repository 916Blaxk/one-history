'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, buscar, mensagem } from '@/lib/cliente';

interface Previa {
  campanha: { id: string; nome: string; descricao: string; mestreNome: string };
  jaParticipa: boolean;
}

export default function PaginaConvite() {
  const { codigo } = useParams<{ codigo: string }>();
  const router = useRouter();
  const { data, error } = useSWR<Previa>(`/api/convites/${encodeURIComponent(codigo)}`, buscar, { revalidateOnFocus: false, shouldRetryOnError: false });
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (data?.jaParticipa) router.replace(`/campanhas/${data.campanha.id}`);
  }, [data, router]);

  async function entrar() {
    setEntrando(true);
    setErro('');
    try {
      const { campanha } = await api('POST', `/api/convites/${encodeURIComponent(codigo)}/entrar`);
      router.push(`/campanhas/${campanha.id}`);
    } catch (e) {
      setErro(mensagem(e));
      setEntrando(false);
    }
  }

  if (error) {
    return (
      <section className="vazio">
        <h2>Convite não encontrado</h2>
        <p>{mensagem(error)}</p>
        <Link className="btn" href="/campanhas">Voltar para campanhas</Link>
      </section>
    );
  }
  if (!data || data.jaParticipa) return <p className="apagado">Abrindo o convite…</p>;
  return (
    <section className="vazio">
      <p className="rotulo">Convite para a campanha</p>
      <h2>{data.campanha.nome}</h2>
      <p>Mestre: {data.campanha.mestreNome}</p>
      {data.campanha.descricao && <p>{data.campanha.descricao}</p>}
      {erro && <p className="erro-form" role="alert">{erro}</p>}
      <div className="acoes">
        <button type="button" className="btn btn-forte" disabled={entrando} onClick={entrar}>Entrar na campanha</button>
        <Link className="btn" href="/campanhas">Agora não</Link>
      </div>
    </section>
  );
}
