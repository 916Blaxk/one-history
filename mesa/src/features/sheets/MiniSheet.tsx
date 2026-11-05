import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Search, X } from 'lucide-react'
import { useChatStore } from '@/features/chat/chat-store'
import { postRoll } from '@/features/chat/post-roll'
import { parseEmbedMessage } from '@/features/sheets/embed-messages'
import {
  fetchSheetPortrait,
  getSheetsOrigin,
  sheetErrorMessage,
  type SheetAction,
  type SheetSummary,
} from '@/features/sheets/sheet-api'
import {
  isValidSheetKey,
  useSheetKeyStore,
} from '@/features/sheets/sheet-keys'
import { useSheetStatusStore } from '@/features/sheets/use-sheet-sync'
import { useTokenStore } from '@/features/tokens/token-store'
import type { Token } from '@/features/tokens/token-types'
import { validCharacterId } from '@/shared/permissions'

function rollFromSheet(token: Token, expression: string, label: string) {
  postRoll(expression, token.name, label)
  useChatStore.getState().requestOpen()
}

export function MiniSheet({ token }: { token: Token }) {
  const base = getSheetsOrigin()
  if (!base) return null
  return (
    <section className="mini-sheet" aria-label="Ficha do personagem">
      <span className="token-sprites-title">Ficha</span>
      {token.characterId ? (
        <LinkedSheet
          key={token.characterId}
          base={base}
          token={token}
          sheetId={token.characterId}
        />
      ) : (
        <LinkForm tokenId={token.id} />
      )}
    </section>
  )
}

function LinkForm({ tokenId }: { tokenId: string }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    const id = value.trim()
    if (!validCharacterId(id)) {
      setError(true)
      return
    }
    useTokenStore.getState().updateToken(tokenId, { characterId: id })
  }
  return (
    <form className="mini-sheet-form" onSubmit={submit}>
      <label className="token-field">
        Id da ficha
        <input
          type="text"
          maxLength={80}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(false)
          }}
        />
      </label>
      {error && (
        <p className="mini-sheet-error">
          Use o id da ficha, sem espaços nem o link inteiro.
        </p>
      )}
      <button className="token-image-button" type="submit" disabled={!value.trim()}>
        Vincular ficha
      </button>
    </form>
  )
}

function KeyForm({ sheetId }: { sheetId: string }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    const key = value.trim()
    if (!isValidSheetKey(key)) {
      setError(true)
      return
    }
    useSheetKeyStore.getState().setKey(sheetId, key)
  }
  return (
    <form className="mini-sheet-form" onSubmit={submit}>
      <label className="token-field">
        Chave da ficha
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(false)
          }}
        />
      </label>
      {error && (
        <p className="mini-sheet-error">
          Esta não parece uma chave do One History. Ela começa com ohi_.
        </p>
      )}
      <p className="mini-sheet-note">
        Só o dono da ficha cria a chave. Ela fica guardada só neste navegador.
      </p>
      <button className="token-image-button" type="submit" disabled={!value.trim()}>
        Salvar chave
      </button>
    </form>
  )
}

function LinkedSheet({
  base,
  token,
  sheetId,
}: {
  base: string
  token: Token
  sheetId: string
}) {
  const sheetKey = useSheetKeyStore((state) => state.keys[sheetId])
  const status = useSheetStatusStore((state) => state.statuses[sheetId])
  const refresh = useSheetStatusStore((state) => state.refresh)
  const [embedOpen, setEmbedOpen] = useState(false)
  const unlink = () =>
    useTokenStore.getState().updateToken(token.id, { characterId: undefined })
  const summary = status?.summary
  const error = status?.error

  return (
    <div className="mini-sheet-body">
      <div className="mini-sheet-link">
        <code title={sheetId}>{sheetId}</code>
        <button className="mini-sheet-text-button" type="button" onClick={unlink}>
          Desvincular
        </button>
      </div>
      {!sheetKey && <KeyForm sheetId={sheetId} />}
      {sheetKey && error && (
        <div className="mini-sheet-message" role="status">
          <p>{sheetErrorMessage(error)}</p>
          <button
            className="mini-sheet-text-button"
            type="button"
            onClick={() => refresh(sheetId)}
          >
            Tentar de novo
          </button>
        </div>
      )}
      {sheetKey && !summary && !error && (
        <p className="mini-sheet-note" role="status">
          Abrindo a ficha…
        </p>
      )}
      {sheetKey && summary && error !== 'invalid-key' && (
        <SheetContent
          base={base}
          sheetKey={sheetKey}
          summary={summary}
          token={token}
          onOpenEmbed={() => setEmbedOpen(true)}
        />
      )}
      {sheetKey && (
        <button
          className="mini-sheet-text-button"
          type="button"
          onClick={() => useSheetKeyStore.getState().forgetKey(sheetId)}
        >
          Esquecer chave neste navegador
        </button>
      )}
      {embedOpen && sheetKey && (
        <EmbeddedSheet
          base={base}
          sheetKey={sheetKey}
          sheetId={sheetId}
          token={token}
          onClose={() => setEmbedOpen(false)}
        />
      )}
    </div>
  )
}

function SheetContent({
  base,
  sheetKey,
  summary,
  token,
  onOpenEmbed,
}: {
  base: string
  sheetKey: string
  summary: SheetSummary
  token: Token
  onOpenEmbed: () => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const term = query.trim().toLowerCase()
    const result = new Map<string, SheetAction[]>()
    for (const action of summary.acoes) {
      if (term && !action.rotulo.toLowerCase().includes(term)) continue
      result.set(action.categoria, [
        ...(result.get(action.categoria) ?? []),
        action,
      ])
    }
    return [...result]
  }, [summary.acoes, query])

  return (
    <>
      <div className="mini-sheet-head">
        {summary.retrato && (
          <SheetPortrait
            key={summary.retrato.versao}
            base={base}
            sheetKey={sheetKey}
            url={summary.retrato.url}
            name={summary.nome}
          />
        )}
        <div className="mini-sheet-identity">
          <strong>{summary.nome}</strong>
          {summary.recursos.map((resource) => (
            <span key={resource.id}>
              {resource.rotulo}: <b>{resource.atual}</b> / {resource.max}
            </span>
          ))}
        </div>
      </div>
      <button className="token-image-button" type="button" onClick={onOpenEmbed}>
        <ExternalLink size={15} /> Abrir ficha completa
      </button>
      <label className="mini-sheet-search">
        <Search size={14} />
        <span className="visually-hidden">Buscar rolagem</span>
        <input
          type="search"
          placeholder="Buscar rolagem"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {groups.map(([category, actions]) => (
        <details className="mini-sheet-group" key={category} open={Boolean(query)}>
          <summary>{category}</summary>
          <ul>
            {actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  aria-label={`Rolar ${action.rotulo}: ${action.expressao}`}
                  onClick={() =>
                    rollFromSheet(token, action.expressao, action.rotulo)
                  }
                >
                  <span>{action.rotulo}</span>
                  <b>{action.expressao}</b>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {query && groups.length === 0 && (
        <p className="mini-sheet-note">Nenhuma rolagem com esse nome.</p>
      )}
      {summary.magias.length > 0 && (
        <details className="mini-sheet-group">
          <summary>Magias</summary>
          <ul>
            {summary.magias.map((spell) => (
              <li className="mini-sheet-spell" key={spell.id}>
                <span>{spell.nome || 'Magia sem nome'}</span>
                <b>{spell.custo} de mana</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

/* Uma tag <img> não envia a chave: o retrato vem por fetch e é mostrado por uma URL local. */
function SheetPortrait({
  base,
  sheetKey,
  url,
  name,
}: {
  base: string
  sheetKey: string
  url: string
  name: string
}) {
  const [source, setSource] = useState<string>()
  useEffect(() => {
    let cancelled = false
    let local: string | undefined
    fetchSheetPortrait(base, url, sheetKey)
      .then((blob) => {
        if (cancelled) return
        local = URL.createObjectURL(blob)
        setSource(local)
      })
      .catch(() => {
        /* Sem retrato, a mini-ficha mostra só o nome. */
      })
    return () => {
      cancelled = true
      if (local) URL.revokeObjectURL(local)
    }
  }, [base, url, sheetKey])
  if (!source) return null
  return <img className="mini-sheet-portrait" src={source} alt={`Retrato de ${name}`} />
}

function EmbeddedSheet({
  base,
  sheetKey,
  sheetId,
  token,
  onClose,
}: {
  base: string
  sheetKey: string
  sheetId: string
  token: Token
  onClose: () => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const refresh = useSheetStatusStore((state) => state.refresh)
  const [unsupported, setUnsupported] = useState(false)
  const latestToken = useRef(token)
  useEffect(() => {
    latestToken.current = token
  }, [token])

  useEffect(() => {
    /* O iframe pode ainda estar carregando: repete até a ficha responder. */
    const hello = setInterval(() => {
      frame.current?.contentWindow?.postMessage({ tipo: 'tablebola:ola' }, base)
    }, 200)
    function onMessage(event: MessageEvent) {
      const message = parseEmbedMessage(event, {
        origin: base,
        frame: frame.current?.contentWindow,
        sheetId,
      })
      if (!message) return
      if (message.kind === 'ready') clearInterval(hello)
      if (message.kind === 'unsupported') {
        clearInterval(hello)
        setUnsupported(true)
      }
      if (message.kind === 'resources') refresh(sheetId)
      if (message.kind === 'roll')
        rollFromSheet(latestToken.current, message.expression, message.label)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(hello)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
    }
  }, [base, sheetId, refresh, onClose])

  return createPortal(
    <div
      className="sheet-embed-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha completa"
    >
      <div className="sheet-embed-window">
        <div className="sheet-embed-heading">
          <span>{token.name}</span>
          <button type="button" aria-label="Fechar ficha" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {unsupported && (
          <p className="mini-sheet-error">{sheetErrorMessage('unsupported')}</p>
        )}
        <iframe
          ref={frame}
          title="Ficha completa"
          src={`${base}/embutido/fichas/${encodeURIComponent(sheetId)}#chave=${sheetKey}`}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>,
    document.body,
  )
}
