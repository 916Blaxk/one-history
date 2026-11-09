import type { DadosFicha } from './regras';

export interface Usuario { id: string; nome: string; email: string }
export interface EntradaRegistro { em: number; txt: string }

export interface Ficha extends DadosFicha {
  id: string;
  donoId: string;
  campanhaId: string | null;
  fotoV: number;
  registro: EntradaRegistro[];
  atualizado: number;
  contexto: {
    souDono: boolean;
    souMestre: boolean;
    donoNome: string;
    campanha: { id: string; nome: string } | null;
  };
}

export interface ChaveIntegracao { id: string; rotulo: string; criadoEm: number }

export type Papel = 'mestre' | 'jogador';

export interface ResumoCampanha {
  id: string; nome: string; descricao: string; papel: Papel; mestreNome: string; jogadores: number; fichas: number;
}

export interface ResumoFicha {
  id: string; nome: string; raca: string; fotoV: number; donoId: string; donoNome: string; completo: boolean;
  /* Só chega ao mestre, nas fichas dele. */
  privada?: boolean;
  estilo?: string; tier?: number; fadiga?: number;
  vidaAtual?: number; vidaMax?: number; manaAtual?: number; manaMax?: number;
}

/* Uma rolagem como mensagem do chat de dados. */
export interface Mensagem {
  id: string; em: number; autor: string; rotulo: string; det: string; total: number;
  minha: boolean; fichaId: string | null; fotoV: number;
}
export interface PaginaChat { mensagens: Mensagem[]; temMais: boolean }

export interface DetalheCampanha {
  campanha: { id: string; nome: string; descricao: string; mestreId: string; mestreNome: string; codigo?: string };
  papel: Papel;
  membros: { id: string; nome: string; papel: Papel }[];
  fichas: ResumoFicha[];
  minhasLivres: { id: string; nome: string }[];
}

/* Um item da biblioteca de monstros, sem as imagens: a miniatura vem de `/api/biblioteca/:id/imagem`. */
export interface MonstroDaBiblioteca {
  id: string;
  nome: string;
  dados: { tamanho: number; altura?: number; cor: string; espelhado: boolean; vidaMax?: number; manaMax?: number; notas?: string };
  temImagem: boolean;
  v: number;
}
