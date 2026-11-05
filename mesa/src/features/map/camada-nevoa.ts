import { CanvasSource, Sprite, Texture } from 'pixi.js'
import type { OpNevoa } from '@mesa/shared/room-protocol'

const COR_NEVOA = '#090a0d'
/* Cada camada é um bitmap: sem este teto, 30 cenários grandes gastariam mais de 1 GB de memória. */
const MAIOR_LADO = 2048

export type Limites = { x: number; y: number; largura: number; altura: number }

/* Desenha a névoa em um canvas e só repinta do zero quando a lista muda de verdade. */
export class CamadaNevoa {
  readonly sprite: Sprite
  private readonly canvas = document.createElement('canvas')
  private readonly contexto: CanvasRenderingContext2D
  private readonly textura: Texture
  private limites: Limites = { x: 0, y: 0, largura: 1, altura: 1 }
  private escala = 1
  private ops: readonly OpNevoa[] = []

  constructor() {
    this.contexto = this.canvas.getContext('2d')!
    this.textura = new Texture({ source: new CanvasSource({ resource: this.canvas }) })
    this.sprite = new Sprite(this.textura)
  }

  mesmosLimites(l: Limites) {
    return l.x === this.limites.x && l.y === this.limites.y && l.largura === this.limites.largura && l.altura === this.limites.altura
  }

  contem(l: Limites) {
    return l.x >= this.limites.x && l.y >= this.limites.y &&
      l.x + l.largura <= this.limites.x + this.limites.largura && l.y + l.altura <= this.limites.y + this.limites.altura
  }

  /* `ops` só cresce no fim enquanto o primeiro item for o mesmo: nesse caso, basta pintar o que chegou. */
  atualizar(ops: readonly OpNevoa[], limites: Limites) {
    if (ops === this.ops && this.mesmosLimites(limites)) return
    const soAcrescentou = this.mesmosLimites(limites) && this.ops.length > 0 && ops[0] === this.ops[0] && ops.length >= this.ops.length
    if (soAcrescentou) {
      for (let i = this.ops.length; i < ops.length; i++) this.pintar(ops[i]!)
    } else {
      this.limites = limites
      this.escala = Math.min(1, MAIOR_LADO / Math.max(limites.largura, limites.altura))
      this.canvas.width = Math.max(1, Math.ceil(limites.largura * this.escala))
      this.canvas.height = Math.max(1, Math.ceil(limites.altura * this.escala))
      this.textura.source.resize(this.canvas.width, this.canvas.height)
      for (const op of ops) this.pintar(op)
    }
    this.ops = ops
    this.sprite.texture = this.textura
    this.sprite.scale.set(1 / this.escala)
    this.textura.source.update()
  }

  posicionar(origemX: number, origemY: number) {
    this.sprite.position.set(origemX + this.limites.x, origemY + this.limites.y)
  }

  private pintar(op: OpNevoa) {
    const c = this.contexto
    const e = this.escala
    const px = (x: number) => (x - this.limites.x) * e
    const py = (y: number) => (y - this.limites.y) * e
    c.globalCompositeOperation = op.tipo === 'traco' && op.revelar ? 'destination-out' : 'source-over'
    c.fillStyle = COR_NEVOA
    c.strokeStyle = COR_NEVOA
    if (op.tipo === 'cobrir') {
      c.fillRect(0, 0, this.canvas.width, this.canvas.height)
    } else if (op.tipo === 'ret') {
      c.fillRect(px(op.x), py(op.y), op.largura * e, op.altura * e)
    } else if (op.pontos.length === 2) {
      c.beginPath()
      c.arc(px(op.pontos[0]!), py(op.pontos[1]!), op.raio * e, 0, Math.PI * 2)
      c.fill()
    } else {
      c.lineWidth = op.raio * 2 * e
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(px(op.pontos[0]!), py(op.pontos[1]!))
      for (let i = 2; i + 1 < op.pontos.length; i += 2) c.lineTo(px(op.pontos[i]!), py(op.pontos[i + 1]!))
      c.stroke()
    }
    c.globalCompositeOperation = 'source-over'
  }

  destruir() {
    this.sprite.removeFromParent()
    this.sprite.destroy()
    this.textura.destroy(true)
  }
}
