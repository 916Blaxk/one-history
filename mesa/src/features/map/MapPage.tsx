import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Map as MapIcon,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import { PixiMap } from '@mesa/features/map/PixiMap'
import { MapControls } from '@mesa/features/map/MapControls'
import { TokenProperties } from '@mesa/features/tokens/TokenProperties'
import { ChatPanel } from '@mesa/features/chat/ChatPanel'
import { useTokenStore } from '@mesa/features/tokens/token-store'

type MobilePanel = 'map' | 'token' | 'chat'

export function MapPage({ campanha }: { campanha: { id: string; nome: string } }) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 768px)').matches,
  )
  const [activePanel, setActivePanel] = useState<MobilePanel | null>(null)
  const selectedTokenId = useTokenStore((state) => state.selectedTokenId)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const visiblePanel =
    activePanel === 'token' && !selectedTokenId ? null : activePanel

  function togglePanel(panel: MobilePanel) {
    setActivePanel((current) =>
      (current === 'token' && !selectedTokenId ? null : current) === panel
        ? null
        : panel,
    )
  }

  return (
    <main className="map-page">
      <PixiMap
        onMapInteraction={() => {
          if (mobile) setActivePanel(null)
        }}
      />
      {/* Um link comum, não o do Next: a página da campanha troca a folha de estilos inteira. */}
      <a className="map-back-link" href={`/campanhas/${campanha.id}`} aria-label={`Voltar para ${campanha.nome}`}>
        <ArrowLeft size={16} />
        <span>Voltar para a campanha</span>
      </a>
      <MapControls
        mobileOpen={mobile ? visiblePanel === 'map' : undefined}
        onMobileClose={() => setActivePanel(null)}
      />
      <TokenProperties
        campanhaId={campanha.id}
        mobileOpen={mobile ? visiblePanel === 'token' : undefined}
        onMobileClose={() => setActivePanel(null)}
      />
      <ChatPanel
        mobileOpen={mobile ? visiblePanel === 'chat' : undefined}
        onMobileClose={() => setActivePanel(null)}
      />
      <div className="map-zoom-hint">
        Bot&atilde;o do meio + arraste tamb&eacute;m move o mapa
      </div>
      <nav className="mobile-map-nav" aria-label="Painéis da mesa">
        <button
          className={visiblePanel === 'map' ? 'is-active' : ''}
          type="button"
          aria-expanded={visiblePanel === 'map'}
          onClick={() => togglePanel('map')}
        >
          <MapIcon size={19} />
          <span>Mapa</span>
        </button>
        <button
          className={visiblePanel === 'token' ? 'is-active' : ''}
          type="button"
          aria-expanded={visiblePanel === 'token'}
          disabled={!selectedTokenId}
          onClick={() => togglePanel('token')}
        >
          <UserRound size={19} />
          <span>Token</span>
        </button>
        <button
          className={visiblePanel === 'chat' ? 'is-active' : ''}
          type="button"
          aria-expanded={visiblePanel === 'chat'}
          onClick={() => togglePanel('chat')}
        >
          <MessageCircle size={19} />
          <span>Chat</span>
        </button>
      </nav>
    </main>
  )
}
