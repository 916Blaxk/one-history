import type { NextConfig } from 'next';
import { montarCsp } from './lib/csp';

const csp = montarCsp(process.env.NODE_ENV !== 'production');

const config: NextConfig = {
  poweredByHeader: false,
  /* Fixa a raiz: um package-lock.json em pasta acima deste projeto não pode confundir o Next. */
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['@libsql/client', 'libsql'],
  async headers() {
    return [{
      /* A rota embutida recebe estes cabeçalhos em proxy.ts, onde a lista de origens é lida ao vivo. */
      source: '/((?!embutido/).*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        /* O código de convite vai na URL: não deixa ele vazar para outros sites. */
        { key: 'Referrer-Policy', value: 'same-origin' },
      ],
    }];
  },
};

export default config;
