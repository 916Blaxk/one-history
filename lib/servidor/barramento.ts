import { EventEmitter } from 'node:events';

/* Avisos entre as rotas do site e a mesa. Os dois rodam no mesmo processo, mas o Next empacota o código à parte:
   por isso o emissor fica em globalThis, e o site precisa rodar em uma única instância. */
export interface LinhaRolagem {
  id: string; campanhaId: string | null; fichaId: string | null; usuarioId: string | null;
  em: number; autor: string; rotulo: string; det: string; total: number;
  expressao?: string | null; detalhe?: unknown;
}
export type EventoMesa =
  | { tipo: 'ficha'; fichaId: string; campanhaId: string | null }
  | { tipo: 'campanha'; campanhaId: string }
  | { tipo: 'campanha-apagada'; campanhaId: string }
  | { tipo: 'rolagem'; campanhaId: string; linha: LinhaRolagem };

const global_ = globalThis as unknown as { __barramentoMesa?: EventEmitter };
const emissor = global_.__barramentoMesa ?? (global_.__barramentoMesa = new EventEmitter());

export function avisarMesa(evento: EventoMesa) {
  emissor.emit('evento', evento);
}
export function ouvirMesa(ouvinte: (evento: EventoMesa) => void) {
  emissor.on('evento', ouvinte);
  return () => { emissor.off('evento', ouvinte); };
}
