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

export type Papel = 'mestre' | 'jogador';

export interface ResumoCampanha {
  id: string; nome: string; descricao: string; papel: Papel; mestreNome: string; jogadores: number; fichas: number;
}

export interface ResumoFicha {
  id: string; nome: string; raca: string; fotoV: number; donoId: string; donoNome: string; completo: boolean;
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
