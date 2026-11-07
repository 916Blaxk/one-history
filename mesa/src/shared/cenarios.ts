import type { RoomScene } from './room-protocol.js'

export const escalaDe = (scene: Pick<RoomScene, 'escala'>) => scene.escala ?? 1
export const acertouCena = (scene: Pick<RoomScene, 'x' | 'y' | 'width' | 'height' | 'escala'>, x: number, y: number) =>
  Math.abs(x - scene.x) <= (scene.width * escalaDe(scene)) / 2 && Math.abs(y - scene.y) <= (scene.height * escalaDe(scene)) / 2

/* O último da lista fica por cima no mapa: é nele que o token caiu. */
export function cenarioNoPonto<T extends Pick<RoomScene, 'x' | 'y' | 'width' | 'height' | 'escala'>>(cenas: readonly T[], x: number, y: number) {
  for (let i = cenas.length - 1; i >= 0; i--) if (acertouCena(cenas[i]!, x, y)) return cenas[i]
  return undefined
}
