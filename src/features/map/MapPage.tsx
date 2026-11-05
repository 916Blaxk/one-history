import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Map as MapIcon,
  MessageCircle,
  UserRound,
} from 'lucide-react'
import { PixiMap } from '@/features/map/PixiMap'
import { MapControls } from '@/features/map/MapControls'
import { TokenProperties } from '@/features/tokens/TokenProperties'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useTokenStore } from '@/features/tokens/token-store'
import { useSheetSync } from '@/features/sheets/use-sheet-sync'

type MobilePanel = 'map' | 'token' | 'chat'

export function MapPage() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 768px)').matches,
  )
  const [activePanel, setActivePanel] = useState<MobilePanel | null>(null)
  const selectedTokenId = useTokenStore((state) => state.selectedTokenId)
  useSheetSync()

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
      <Link className="map-back-link" to="/" aria-label="Voltar ao início">
        <ArrowLeft size={16} />
        <span>Voltar ao in&iacute;cio</span>
      </Link>
      <MapControls
        mobileOpen={mobile ? visiblePanel === 'map' : undefined}
        onMobileClose={() => setActivePanel(null)}
      />
      <TokenProperties
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
