import { rollDice } from '@/features/chat/dice-parser'
import { SUPPORTED_SCHEMA_VERSION } from '@/features/sheets/sheet-api'
import { validRollLabel } from '@/shared/permissions'

export type EmbedMessage =
  | { kind: 'ready' }
  | { kind: 'roll'; expression: string; label: string }
  | { kind: 'resources' }
  | { kind: 'unsupported' }

type IncomingEvent = { origin: string; source: unknown; data: unknown }
type EmbedContext = { origin: string; frame: unknown; sheetId: string }

function validExpression(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 120) return false
  if ((value.match(/d/gi)?.length ?? 0) > 10) return false
  try {
    rollDice(value)
    return true
  } catch {
    return false
  }
}

/* Devolve null para tudo o que não veio da ficha aberta. O iframe pede a rolagem, mas o conteúdo não é confiável. */
export function parseEmbedMessage(
  event: IncomingEvent,
  context: EmbedContext,
): EmbedMessage | null {
  if (event.origin !== context.origin || !context.frame) return null
  if (event.source !== context.frame) return null
  const data = event.data
  if (typeof data !== 'object' || data === null) return null
  const message = data as Record<string, unknown>
  if (
    typeof message.schemaVersion !== 'number' ||
    message.fichaId !== context.sheetId
  )
    return null
  if (message.schemaVersion > SUPPORTED_SCHEMA_VERSION)
    return { kind: 'unsupported' }
  switch (message.tipo) {
    case 'oh:pronto':
      return { kind: 'ready' }
    case 'oh:recursos':
      return { kind: 'resources' }
    case 'oh:rolagem':
      if (!validExpression(message.expressao)) return null
      if (typeof message.rotulo !== 'string' || !validRollLabel(message.rotulo))
        return null
      return {
        kind: 'roll',
        expression: message.expressao,
        label: message.rotulo,
      }
    default:
      return null
  }
}
