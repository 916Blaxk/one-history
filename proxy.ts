import { NextResponse } from 'next/server';
import { montarCsp } from './lib/csp';
import { lerOrigens } from './lib/integracao';

/* Em next.config.ts a lista ficaria presa ao que existia na hora do build. Aqui, mudar a variável e reiniciar basta. */
export function proxy() {
  const resposta = NextResponse.next();
  resposta.headers.set('Content-Security-Policy', montarCsp(process.env.NODE_ENV !== 'production', lerOrigens(process.env.ORIGENS_TABLEBOLA)));
  resposta.headers.set('X-Content-Type-Options', 'nosniff');
  resposta.headers.set('Referrer-Policy', 'same-origin');
  return resposta;
}

export const config = { matcher: '/embutido/:caminho*' };
