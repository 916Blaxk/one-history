/* A política de segurança das páginas. Só a rota embutida troca `ancestrais`: todo o resto continua sem poder entrar em iframe. */
export function montarCsp(dev: boolean, ancestrais: readonly string[] = []) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${ancestrais.length ? ancestrais.join(' ') : "'none'"}`,
  ].join('; ');
}
