/* Fica fora de lib/tema.ts porque o layout, que roda no servidor, só pode importar texto puro:
   uma constante vinda de um módulo 'use client' chegaria ao servidor como referência, não como texto.
   Roda antes da página pintar: sem ele, quem escolheu laranja veria o roxo piscar. */
export const CHAVE_TEMA = 'oh-tema';
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CHAVE_TEMA}');if(t==='azul'||t==='laranja'||t==='roxo')document.documentElement.dataset.tema=t}catch(e){}`;
