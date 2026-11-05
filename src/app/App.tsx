import { lazy, Suspense } from 'react'
import { ArrowUpRight, BookOpen, Dices, Sparkles } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useUiStore } from '@/stores/ui-store'

const MapPage = lazy(() =>
  import('@/features/map/MapPage').then((module) => ({
    default: module.MapPage,
  })),
)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="map-loading">Preparando a mesa...</div>}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/mesa" element={<MapPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function LandingPage() {
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
                <Button>
                  <Sparkles size={16} /> Criar sala <ArrowUpRight size={15} />
                </Button>
                <Button variant="outline">
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
    </main>
  )
}
