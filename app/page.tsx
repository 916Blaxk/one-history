import { redirect } from 'next/navigation';
import { usuarioDaSessao } from '@/lib/servidor/sessao';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  redirect((await usuarioDaSessao()) ? '/fichas' : '/entrar');
}
