/* Chamadas à API a partir do navegador. */
export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}

export async function api<T = any>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  const leitura = metodo === 'GET';
  let r: Response;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: leitura ? undefined : { 'Content-Type': 'application/json' },
      body: leitura ? undefined : JSON.stringify(corpo ?? {}),
      /* Deixa o salvamento terminar mesmo se a pessoa fechar a aba logo depois de editar. */
      keepalive: metodo === 'PATCH' && !(corpo as { foto?: string } | undefined)?.foto,
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.');
  }
  const dados = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && url !== '/api/conta/entrar') {
      window.location.assign(`/entrar?destino=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ErroApi(r.status, dados?.erro || 'Algo deu errado. Tente de novo em instantes.');
  }
  return dados as T;
}

export const buscar = <T,>(url: string) => api<T>('GET', url);
export const urlFoto = (id: string, v: number) => `/api/fichas/${id}/foto?v=${v}`;
export const mensagem = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado. Tente de novo em instantes.');
export const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0);
export const virgula = (n: number) => String(n).replace('.', ',');
export const dataCurta = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
