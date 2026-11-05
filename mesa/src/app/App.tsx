import { lazy, Suspense, useState } from 'react'
import { ArrowUpRight, BookOpen, Dices, Sparkles } from 'lucide-react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUiStore } from '@/stores/ui-store'

const MapPage = lazy(() =>
  import('@/features/map/MapPage').then((module) => ({
    default: module.MapPage,
  })),
)

const RoomPage = lazy(() =>
  import('@/features/rooms/RoomPage').then((module) => ({
    default: module.RoomPage,
  })),
)

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function createRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(
    bytes,
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length],
  ).join('')
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="map-loading">Preparando a mesa...</div>}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/mesa" element={<MapPage />} />
          <Route path="/sala/:code" element={<RoomPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function LandingPage() {
  const navigate = useNavigate()
  const [roomDialog, setRoomDialog] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const visits = useUiStore((state) => state.counter)
  const increment = useUiStore((state) => state.increment)

  return (
    <main className="landing-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#inicio">
          <span className="brand-mark">
            <Dices size={19} />
          </span>{' '}
          TABLEBOLA
        </a>
        <span className="edition">EDIÇÃO DE MESA · 001</span>
      </header>
      <section className="hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> UM ESPAÇO PARA GRANDES HISTÓRIAS
          </div>
          <h1>
            As lendas
            <br />
            começam <em>à mesa.</em>
          </h1>
          <p className="intro">
            Reúna seu grupo, prepare os dados e atravesse o véu. Sua próxima
            aventura está prestes a começar.
          </p>
          <Card className="welcome-card">
            <CardContent className="welcome-content">
              <div className="card-heading">
                <div className="icon-frame">
                  <BookOpen size={19} />
                </div>
                <div>
                  <span className="overline">O salão está aberto</span>
                  <h2>Por onde começamos?</h2>
                </div>
              </div>
              <p>
                Crie uma mesa para seus amigos ou entre em uma aventura que já
                está em curso.
              </p>
              <div className="actions">
                <Button
                  onClick={() =>
                    navigate(`/sala/${createRoomCode().toLowerCase()}`)
                  }
                >
                  <Sparkles size={16} /> Criar sala <ArrowUpRight size={15} />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRoomCode('')
                    setRoomDialog(true)
                  }}
                >
                  Entrar em sala <ArrowUpRight size={15} />
                </Button>
              </div>
              <div className="counter-note">
                <button type="button" onClick={increment}>
                  Contador de demonstração · clique para testar
                </button>
                <strong>{visits}</strong>
              </div>
            </CardContent>
          </Card>
          <div className="footnote">
            <span className="rule" /> FEITO PARA A SUA MESA, E MAIS
            NINGU&Eacute;M.
          </div>
          <Link className="open-table-link" to="/mesa">
            Abrir mesa de testes <ArrowUpRight size={14} />
          </Link>
        </div>
        <aside className="hero-art" aria-hidden="true">
          <div className="seal seal-outer" />
          <div className="seal seal-middle" />
          <div className="seal seal-inner">
            <Dices size={94} strokeWidth={0.8} />
          </div>
          <span className="orbit orbit-top">✦</span>
          <span className="orbit orbit-bottom">✧</span>
          <div className="art-caption">
            <span>✦</span>
            <div>
              <b>O destino aguarda</b>
              <small>Role os dados. Conte a história.</small>
            </div>
          </div>
        </aside>
      </section>
      <footer className="footer">
        <span>
          TABLEBOLA <i>•</i> UM VTT PARA AMIGOS
        </span>
        <span>
          QUE OS DADOS ESTEJAM A SEU FAVOR <b>✦</b>
        </span>
      </footer>
      {roomDialog && (
        <div
          className="room-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRoomDialog(false)
          }}
        >
          <form
            className="room-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-room-title"
            onSubmit={(event) => {
              event.preventDefault()
              const normalized = roomCode.trim().toLowerCase()
              if (/^[a-hj-np-z2-9]{6}$/.test(normalized))
                navigate(`/sala/${normalized}`)
            }}
          >
            <h2 id="join-room-title">Entrar em sala</h2>
            <p>Digite o código de seis caracteres enviado pelo grupo.</p>
            <label>
              Código da sala
              <input
                autoFocus
                required
                minLength={6}
                maxLength={6}
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-HJ-KM-NP-Z2-9]/g, ''),
                  )
                }
                placeholder="Ex.: 7KPM4B"
              />
            </label>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoomDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!/^[A-HJ-KM-NP-Z2-9]{6}$/.test(roomCode)}
              >
                Entrar
              </Button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
