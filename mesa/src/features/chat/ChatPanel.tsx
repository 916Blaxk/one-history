import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ChevronDown, MessageCircle, Send, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useChatStore } from '@/features/chat/chat-store'
import type { ChatMessage } from '@/features/chat/chat-types'
import type {
  DiceGroupResult,
  DiceRollResult,
  DieResult,
} from '@/features/chat/dice-types'
import { postRoll } from '@/features/chat/post-roll'
import { useTokenStore } from '@/features/tokens/token-store'
import { useBottomSheetDismiss } from '@/hooks/use-bottom-sheet-dismiss'
import { isRoomMode, sendRoomCommand } from '@/features/rooms/room-commands'
import { useRoomStore } from '@/features/rooms/room-store'

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100]
const COMMAND_HELP =
  'Comandos: /r ou /roll <dados>, /w <nome> <mensagem>, /gm <mensagem>, /me <ação> e /clear.'

export function ChatPanel({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [quickOpen, setQuickOpen] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(0)
  const draftBeforeHistory = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useChatStore((state) => state.messages)
  const commandHistory = useChatStore((state) => state.commandHistory)
  const addMessage = useChatStore((state) => state.addMessage)
  const addToCommandHistory = useChatStore((state) => state.addToCommandHistory)
  const clearMessages = useChatStore((state) => state.clearMessages)
  const role = useRoomStore((state) => state.role)
  const spectator = isRoomMode() && role === 'spectator'
  const author = useTokenStore(
    (state) =>
      state.tokens.find((token) => token.id === state.selectedTokenId)?.name ??
      'Jogador',
  )
  const mobileMode = mobileOpen !== undefined
  const panelOpen = mobileMode ? mobileOpen : isOpen
  const dragHandlers = useBottomSheetDismiss(Boolean(mobileOpen), onMobileClose)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, panelOpen])

  useEffect(() => {
    if (!mobileMode || !window.visualViewport) return
    const viewport = window.visualViewport
    const updateViewport = () => {
      const keyboardInset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      )
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${viewport.height}px`,
      )
      document.documentElement.style.setProperty(
        '--virtual-keyboard-inset',
        `${keyboardInset}px`,
      )
      document.documentElement.classList.toggle(
        'chat-keyboard-open',
        keyboardInset > 100,
      )
    }
    updateViewport()
    viewport.addEventListener('resize', updateViewport)
    viewport.addEventListener('scroll', updateViewport)
    return () => {
      viewport.removeEventListener('resize', updateViewport)
      viewport.removeEventListener('scroll', updateViewport)
      document.documentElement.style.removeProperty('--visual-viewport-height')
      document.documentElement.style.removeProperty('--virtual-keyboard-inset')
      document.documentElement.classList.remove('chat-keyboard-open')
    }
  }, [mobileMode])

  useEffect(() => {
    function onShortcut(event: globalThis.KeyboardEvent) {
      const target = event.target
      const isEditing =
        target instanceof HTMLElement &&
        Boolean(
          target.closest('input, textarea, select, [contenteditable="true"]'),
        )
      if (!mobileMode && !isEditing && event.key.toLowerCase() === 'c')
        setIsOpen((open) => !open)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [mobileMode])

  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.openRequests !== previous.openRequests) setIsOpen(true)
      }),
    [],
  )

  function roll(expression: string) {
    postRoll(expression, author)
    setIsOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const raw = input.trim()
    if (!raw) return
    addToCommandHistory(raw)
    setHistoryIndex(commandHistory.length + 1)
    setInput('')

    if (!raw.startsWith('/')) {
      if (isRoomMode())
        sendRoomCommand({
          type: 'chat:send',
          message: { type: 'normal', text: raw },
        })
      else addMessage({ type: 'normal', author, text: raw })
      return
    }

    const match = raw.match(/^\/(\S+)(?:\s+([\s\S]*))?$/)
    const command = match?.[1]?.toLowerCase() ?? ''
    const argument = match?.[2] ?? ''
    if (command === 'r' || command === 'roll') {
      roll(argument)
    } else if (command === 'w') {
      const whisper = argument.match(/^(\S+)(?:\s+([\s\S]+))$/)
      if (!whisper)
        addMessage({
          type: 'system',
          author: 'Sistema',
          text: 'Use /w <nome> <mensagem> para enviar um sussurro.',
        })
      else if (isRoomMode())
        sendRoomCommand({
          type: 'chat:send',
          message: { type: 'whisper', recipient: whisper[1], text: whisper[2] },
        })
      else
        addMessage({
          type: 'whisper',
          author,
          recipient: whisper[1],
          text: whisper[2],
        })
    } else if (command === 'gm') {
      if (!argument.trim())
        addMessage({
          type: 'system',
          author: 'Sistema',
          text: 'Use /gm <mensagem> para escrever uma mensagem ao mestre.',
        })
      else if (isRoomMode())
        sendRoomCommand({
          type: 'chat:send',
          message: { type: 'gm', text: argument.trim() },
        })
      else addMessage({ type: 'gm', author, text: argument.trim() })
    } else if (command === 'me') {
      if (!argument.trim())
        addMessage({
          type: 'system',
          author: 'Sistema',
          text: 'Use /me <ação> para narrar uma ação.',
        })
      else if (isRoomMode())
        sendRoomCommand({
          type: 'chat:send',
          message: { type: 'action', text: argument.trim() },
        })
      else addMessage({ type: 'action', author, text: argument.trim() })
    } else if (command === 'clear' && !argument.trim()) {
      clearMessages()
    } else {
      addMessage({
        type: 'system',
        author: 'Sistema',
        text:
          command === 'clear'
            ? 'O comando /clear não recebe argumentos.'
            : `Comando desconhecido. ${COMMAND_HELP}`,
      })
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (commandHistory.length === 0) return
    event.preventDefault()
    if (event.key === 'ArrowUp') {
      if (historyIndex === commandHistory.length)
        draftBeforeHistory.current = input
      const nextIndex = Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex] ?? '')
    } else if (historyIndex < commandHistory.length - 1) {
      const nextIndex = historyIndex + 1
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex] ?? '')
    } else {
      setHistoryIndex(commandHistory.length)
      setInput(draftBeforeHistory.current)
    }
  }

  function quickRoll(sides: number, shifted: boolean) {
    const count = shifted && quantity === 1 ? 2 : quantity
    roll(`${count}d${sides}`)
  }

  return (
    <div
      className={`chat-widget ${mobileMode ? 'mobile-chat-controlled' : ''}`}
    >
      {panelOpen && (
        <Card className="chat-panel mobile-bottom-sheet mobile-sheet-open">
          <div
            className="chat-panel-heading mobile-sheet-heading"
            {...dragHandlers}
          >
            <span className="mobile-sheet-handle" />
            <div>
              <span className="chat-panel-kicker">MESA DE TESTES</span>
              <h2>Chat da mesa</h2>
            </div>
            <button
              className="chat-close-button desktop-chat-close"
              type="button"
              aria-label="Fechar chat"
              onClick={() => setIsOpen(false)}
            >
              <X size={17} />
            </button>
            <button
              className="mobile-sheet-close"
              type="button"
              aria-label="Fechar painel"
              onClick={onMobileClose}
            >
              <X size={18} />
            </button>
          </div>
          <CardContent className="chat-panel-content">
            <div className="chat-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="chat-empty">
                  As mensagens e rolagens da mesa aparecerão aqui.
                </div>
              )}
              {messages.map((message) => (
                <ChatMessageView key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {!spectator && <div className="quick-roller">
              <button
                className="mobile-quick-toggle"
                type="button"
                aria-expanded={quickOpen}
                onClick={() => setQuickOpen((value) => !value)}
              >
                Rolagem rápida <ChevronDown size={15} />
              </button>
              <div
                className={`quick-roller-content ${quickOpen ? 'is-expanded' : ''}`}
              >
                <div className="quick-roller-heading">
                  <span>Rolagem rápida</span>
                  <label className="quick-quantity-desktop">
                    Qtd.{' '}
                    <input
                      aria-label="Quantidade de dados"
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          Math.min(
                            100,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="quick-roller-tools">
                  <div className="quick-dice-buttons">
                    {QUICK_DICE.map((sides) => (
                      <button
                        type="button"
                        key={sides}
                        title={`Rolar d${sides}; Shift+clique rola dois se a quantidade for 1`}
                        onClick={(event) => quickRoll(sides, event.shiftKey)}
                      >
                        d{sides}
                      </button>
                    ))}
                  </div>
                  <label className="quick-quantity">
                    Qtd.{' '}
                    <input
                      aria-label="Quantidade de dados"
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          Math.min(
                            100,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>}
            <form className="chat-compose" onSubmit={submit}>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  setHistoryIndex(commandHistory.length)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Mensagem ou /r 2d6+3"
                aria-label="Mensagem ou comando"
              />
              <button type="submit" aria-label="Enviar mensagem">
                <Send size={17} />
              </button>
            </form>
            {!mobileMode && (
              <p className="chat-shortcut-hint">
                Enter envia · ↑/↓ histórico · C abre/fecha
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {!mobileMode && (
        <button
          className={`chat-toggle ${isOpen ? 'is-open' : ''}`}
          type="button"
          aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <MessageCircle size={19} />
          <span>{isOpen ? 'Fechar chat' : 'Chat'}</span>
          {messages.length > 0 && !isOpen && <b>{messages.length}</b>}
        </button>
      )}
    </div>
  )
}

function ChatMessageView({ message }: { message: ChatMessage }) {
  const timestamp = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const authorLine =
    message.type === 'whisper' ? (
      <>
        <b>{message.author}</b>
        <span> sussurra para {message.recipient}</span>
      </>
    ) : message.type === 'gm' ? (
      <>
        <b>{message.author}</b>
        <span> · para o mestre</span>
      </>
    ) : message.type === 'action' ? (
      <>
        <b>* {message.author}</b>
        <span> {message.text} *</span>
      </>
    ) : (
      <b>{message.author}</b>
    )

  return (
    <article className={`chat-message chat-message-${message.type}`}>
      <div className="chat-message-meta">
        <span>{authorLine}</span>
        <time>{timestamp}</time>
      </div>
      {message.type !== 'action' && message.type !== 'roll' && (
        <p>{message.text}</p>
      )}
      {message.label && <p className="chat-roll-label">{message.label}</p>}
      {message.roll && <DiceRollCard result={message.roll} />}
    </article>
  )
}

function DiceRollCard({ result }: { result: DiceRollResult }) {
  const [rolling, setRolling] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 65)
    const timeout = window.setTimeout(() => setRolling(false), 760)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [])

  const critical = result.groups.some((group) => group.critical)
  const criticalFailure = result.groups.some((group) => group.criticalFailure)
  return (
    <div
      className={`dice-roll-card ${rolling ? 'is-rolling' : ''} ${critical ? 'is-critical' : ''} ${criticalFailure ? 'is-critical-failure' : ''}`}
    >
      <div className="dice-roll-expression">{result.expression}</div>
      {result.groups.map((group, groupIndex) => (
        <DiceGroupView
          key={`${groupIndex}-${group.sides}`}
          group={group}
          index={groupIndex}
          tick={tick}
          rolling={rolling}
        />
      ))}
      {result.flatModifiers.map((modifier, index) => (
        <div className="dice-flat-modifier" key={index}>
          Modificador {formatSigned(modifier.value)}
        </div>
      ))}
      {(critical || criticalFailure) && (
        <div className="dice-critical-label">
          {critical ? 'Acerto crítico!' : 'Falha crítica!'}
        </div>
      )}
      <div className="dice-total-row">
        <span>Total</span>
        <strong>{rolling ? '…' : result.total}</strong>
      </div>
    </div>
  )
}

function DiceGroupView({
  group,
  index,
  tick,
  rolling,
}: {
  group: DiceGroupResult
  index: number
  tick: number
  rolling: boolean
}) {
  const selection = group.selection
    ? `${group.selection}${group.selectionCount}`
    : ''
  const expression = `${group.sign < 0 ? '−' : ''}${group.count}d${group.sides}${selection}${group.exploding ? '!' : ''}`
  return (
    <div className="dice-group-result">
      <div className="dice-group-heading">
        <span>{expression}</span>
        <b>{rolling ? 'rolando' : formatSigned(group.total)}</b>
      </div>
      <div className="dice-faces">
        {group.dice.map((die, dieIndex) => (
          <DieFace
            key={dieIndex}
            die={die}
            group={group}
            groupIndex={index}
            index={dieIndex}
            tick={tick}
            rolling={rolling}
          />
        ))}
      </div>
      {group.modifier !== 0 && (
        <div className="dice-group-modifier">
          Modificador {formatSigned(group.modifier)}
        </div>
      )}
      {group.explosionLimitReached && (
        <div className="dice-limit-note">
          Limite de explosões atingido neste grupo.
        </div>
      )}
    </div>
  )
}

function DieFace({
  die,
  group,
  groupIndex,
  index,
  tick,
  rolling,
}: {
  die: DieResult
  group: DiceGroupResult
  groupIndex: number
  index: number
  tick: number
  rolling: boolean
}) {
  return (
    <span className={`die-face ${die.kept ? '' : 'is-discarded'}`}>
      {die.rolls.map((value, rollIndex) => {
        const displayValue = rolling
          ? ((tick * 7 + groupIndex * 11 + index * 5 + rollIndex * 3) %
              group.sides) +
            1
          : value
        return (
          <span key={rollIndex}>
            {rollIndex > 0 && <i>↻</i>}
            {displayValue}
          </span>
        )
      })}
    </span>
  )
}

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)}`
}
