/* Fica fora de lib/tema.ts porque o layout, que roda no servidor, só pode importar texto puro:
   uma constante vinda de um módulo 'use client' chegaria ao servidor como referência, não como texto.
   Roda antes da página pintar: sem ele, quem escolheu laranja veria o roxo piscar. */
export const CHAVE_TEMA = 'oh-tema';
export const IDS_TEMA = ['roxo', 'azul', 'laranja', 'verde', 'rosa', 'branco', 'vermelho', 'marrom', 'amarelo'] as const;
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CHAVE_TEMA}');if(${JSON.stringify(IDS_TEMA)}.indexOf(t)>=0)document.documentElement.dataset.tema=t}catch(e){}`;
