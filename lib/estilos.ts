/* Os ícones de dado. Cada um tem dono único no site: o servidor recusa um ícone que já é de outra conta.
   Fica fora de lib/tema.ts porque o servidor também lê esta lista, e aquele arquivo é só do navegador. */

export interface EstiloDado {
  id: string;
  /* Só para leitor de tela e dica ao passar o mouse: na escolha, aparece só o ícone. */
  nome: string;
  /* A cor principal, a clara (texto e brilho) e a escura (fundo do cartão). As chamas do crítico usam as mesmas. */
  cor: string; claro: string; escuro: string;
  /* Ícone de uma conta só. Quem pode usar fica no servidor (lib/servidor/exclusivos.ts), e não aqui:
     esta lista vai para o navegador, e o e-mail do dono não precisa ir junto. */
  exclusivo?: boolean;
  /* No acerto extremo de combate, troca o fogo e o solo por raio, tremor e o som próprio do ícone. */
  raio?: boolean;
}

export const ESTILOS_DADO: readonly EstiloDado[] = [
  { id: 'diabo', nome: 'Diabo', cor: '#ff1f2e', claro: '#ff9a3c', escuro: '#3d0409' },
  { id: 'caveira', nome: 'Caveira', cor: '#b98cff', claro: '#f3ecff', escuro: '#1c0f33' },
  { id: 'olho-dragao', nome: 'Olho de dragão', cor: '#ffae00', claro: '#ffe680', escuro: '#3a2200' },
  { id: 'fenix', nome: 'Fênix', cor: '#ff5a00', claro: '#ffd23d', escuro: '#3d1000' },
  { id: 'serpente', nome: 'Serpente', cor: '#00e676', claro: '#b6ff5c', escuro: '#002b16' },
  { id: 'lua-sangue', nome: 'Lua de sangue', cor: '#ff0a54', claro: '#ff8fab', escuro: '#3a0014' },
  { id: 'tempestade', nome: 'Tempestade', cor: '#2f9bff', claro: '#fff35c', escuro: '#04193a' },
  { id: 'coroa', nome: 'Coroa', cor: '#ffc400', claro: '#fff4b8', escuro: '#352600' },
  { id: 'aranha', nome: 'Aranha', cor: '#d400ff', claro: '#ff7ef0', escuro: '#2a0033' },
  { id: 'kraken', nome: 'Kraken', cor: '#00c2ff', claro: '#7dfff0', escuro: '#002a3d' },
  { id: 'cristal', nome: 'Cristal', cor: '#00ffd0', claro: '#ff8cf5', escuro: '#003330' },
  { id: 'garras', nome: 'Garras', cor: '#ff3d7f', claro: '#ffc2d6', escuro: '#3a0a1c' },
  { id: 'laminas', nome: 'Lâminas', cor: '#6e9bff', claro: '#eef3ff', escuro: '#0b1638' },
  { id: 'alma', nome: 'Alma penada', cor: '#4dfff3', claro: '#e0fffd', escuro: '#002e33' },
  { id: 'olho-piramide', nome: 'Olho que tudo vê', cor: '#9d4dff', claro: '#ffd84d', escuro: '#1f0a3d' },
  { id: 'coracao', nome: 'Coração em chamas', cor: '#ff2d6f', claro: '#ffb03b', escuro: '#3d0a1a' },
  { id: 'veneno', nome: 'Veneno', cor: '#7cff00', claro: '#eaff8f', escuro: '#173300' },
  { id: 'ampulheta', nome: 'Ampulheta', cor: '#ff8a3d', claro: '#7cf4ff', escuro: '#2e1405' },
  { id: 'cometa', nome: 'Cometa', cor: '#ff3dbb', claro: '#fff0a8', escuro: '#330a26' },
  { id: 'engrenagem', nome: 'Engrenagem', cor: '#e0001b', claro: '#ff3b3b', escuro: '#000000', exclusivo: true, raio: true },
];

export const ehEstiloDado = (id: unknown): id is string => typeof id === 'string' && ESTILOS_DADO.some(e => e.id === id);
export const estiloDado = (id: string | null | undefined) => ESTILOS_DADO.find(e => e.id === id) ?? null;
/* O raio só vale no acerto extremo de uma rolagem de combate, com um ícone que tem raio. */
export const temRaio = (estilo: string | null | undefined, combate: boolean) => combate && !!estiloDado(estilo)?.raio;
