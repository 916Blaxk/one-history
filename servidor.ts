/* O único servidor do site: o Next e o Socket.IO da mesa no mesmo processo e na mesma porta.
   A Vercel não serve, porque não mantém conexões abertas. Rode uma única instância: veja docs/unificacao-mesa.md. */
import { createServer } from 'node:http';
import { loadEnvConfig } from '@next/env';

async function principal() {
  const dev = process.argv.includes('--dev');
  (process.env as Record<string, string>).NODE_ENV = dev ? 'development' : 'production';
  /* Antes de importar o banco: lib/servidor/db.ts lê DATABASE_URL ao carregar. */
  loadEnvConfig(process.cwd(), dev);

  const { default: next } = await import('next');
  const { anexarMesa } = await import('./mesa/server/index');
  const porta = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const app = next({ dev, hostname: host, port: porta });
  const atender = app.getRequestHandler();
  await app.prepare();

  const servidor = createServer((req, res) => { void atender(req, res); });
  const encerrarMesa = anexarMesa(servidor);
  if (dev) {
    const atualizar = app.getUpgradeHandler();
    /* O Socket.IO cuida do próprio caminho. O resto é o recarregamento automático do Next. */
    servidor.on('upgrade', (req, socket, cabeca) => {
      if (!req.url?.startsWith('/socket.io/')) void atualizar(req, socket, cabeca);
    });
  }

  let encerrando = false;
  const encerrar = () => {
    if (encerrando) return;
    encerrando = true;
    /* Grava o que está na memória antes de sair. */
    void encerrarMesa().catch(e => console.error(e)).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);

  servidor.listen(porta, host, () => console.log(`One History em http://localhost:${porta}`));
}

principal().catch(e => {
  console.error(e);
  process.exit(1);
});
