import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  `connect-src 'self'${dev ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  /* Fixa a raiz: um package-lock.json em pasta acima deste projeto não pode confundir o Next. */
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['@libsql/client', 'libsql'],
  async headers() {
    return [{
      source: '/:caminho*',
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
