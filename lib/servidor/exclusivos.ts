/* Ícones de uma conta só: o e-mail de quem pode usar cada um. O servidor é quem decide, na escolha do ícone;
   o navegador só esconde o que a conta não pode escolher. Fica fora de lib/estilos.ts para o e-mail não ir ao navegador. */
const DONOS: Readonly<Record<string, string>> = {
  engrenagem: 'caioblackstar@gmail.com',
};

const normalizarEmail = (email: string) => email.trim().toLowerCase();

/* Ícone sem dono na lista é de todos (mas segue a regra de um dono por vez, no índice único do banco). */
export function podeUsarEstilo(estilo: string, email: string) {
  const dono = DONOS[estilo];
  return !dono || normalizarEmail(dono) === normalizarEmail(email);
}

/* Os exclusivos que esta conta pode escolher. */
export const exclusivosDaConta = (email: string) => Object.keys(DONOS).filter(id => podeUsarEstilo(id, email));
