import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Trash2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTokenStore } from '@/features/tokens/token-store'
import { useUiStore } from '@/stores/ui-store'
import type { Token } from '@/features/tokens/token-types'
import type { TokenSprite } from '@/features/tokens/token-types'
import { useBottomSheetDismiss } from '@/hooks/use-bottom-sheet-dismiss'

const EMPTY_SPRITES: TokenSprite[] = []

export function TokenProperties({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [spritesExpanded, setSpritesExpanded] = useState(false)
  const selectedTokenId = useTokenStore((state) => state.selectedTokenId)
  const token = useTokenStore((state) =>
    state.tokens.find((item) => item.id === selectedTokenId),
  )
  const sprites = useTokenStore(
    (state) => state.spritesByTokenId[selectedTokenId ?? ''] ?? EMPTY_SPRITES,
  )
  const updateToken = useTokenStore((state) => state.updateToken)
  const removeToken = useTokenStore((state) => state.removeToken)
  const addTokenSprites = useTokenStore((state) => state.addTokenSprites)
  const renameTokenSprite = useTokenStore((state) => state.renameTokenSprite)
  const selectTokenSprite = useTokenStore((state) => state.selectTokenSprite)
  const removeTokenSprite = useTokenStore((state) => state.removeTokenSprite)
  const mobileMode = mobileOpen !== undefined
  const contentVisible = mobileMode ? mobileOpen : !collapsed
  const dragHandlers = useBottomSheetDismiss(Boolean(mobileOpen), onMobileClose)

  if (!token) return null
  const selectedToken = token

  function setValue(changes: Partial<Omit<Token, 'id'>>) {
    updateToken(selectedToken.id, changes)
  }

  const activeSprite = sprites.find(
    (sprite) => sprite.id === selectedToken.activeSpriteId,
  )

  function changeSize(size: Token['size']) {
    const grid = useUiStore.getState().grid
    if (!grid.enabled) {
      setValue({ size })
      return
    }
    const cellSize = grid.cellSize
    const snap = (value: number) =>
      (Math.round(value / cellSize - size / 2) + size / 2) * cellSize
    setValue({ size, x: snap(selectedToken.x), y: snap(selectedToken.y) })
  }

  return (
    <Card
      className={`token-properties mobile-bottom-sheet ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-sheet-open' : ''}`}
    >
      <div
        className="token-properties-heading mobile-sheet-heading"
        {...dragHandlers}
      >
        <span className="mobile-sheet-handle" />
        <div>
          <span className="token-properties-kicker">TOKEN SELECIONADO</span>
          <h2>Propriedades</h2>
        </div>
        <div className="token-properties-heading-actions">
          <button
            className="token-collapse-button"
            type="button"
            aria-label={
              collapsed
                ? 'Expandir propriedades do token'
                : 'Minimizar propriedades do token'
            }
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir' : 'Minimizar'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          <button
            className="token-remove-icon"
            type="button"
            aria-label="Remover token"
            title="Remover token"
            onClick={() => removeToken(token.id)}
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
      </div>
      {contentVisible && (
        <CardContent className="token-properties-content mobile-sheet-content">
          <label className="token-field">
            Nome
            <input
              type="text"
              maxLength={32}
              value={selectedToken.name}
              onChange={(event) => setValue({ name: event.target.value })}
            />
          </label>
          <div className="token-field-row">
            <label className="token-field">
              Tamanho
              <select
                value={selectedToken.size}
                onChange={(event) =>
                  changeSize(Number(event.target.value) as Token['size'])
                }
              >
                <option value={1}>1 célula</option>
                <option value={2}>2 células</option>
                <option value={3}>3 células</option>
                <option value={4}>4 células</option>
              </select>
            </label>
            <label className="token-field">
              Cor
              <input
                className="token-color"
                aria-label="Cor do token"
                type="color"
                value={selectedToken.color}
                onChange={(event) => setValue({ color: event.target.value })}
              />
            </label>
          </div>
          <label className="token-field token-rotation">
            Rotação <b>{selectedToken.rotation}°</b>
            <input
              type="range"
              min="0"
              max="359"
              value={selectedToken.rotation}
              onChange={(event) =>
                setValue({ rotation: Number(event.target.value) })
              }
            />
          </label>
          <div className="token-field-row">
            <label className="token-field">
              PV atual
              <input
                type="number"
                min="0"
                value={selectedToken.hpCurrent ?? ''}
                placeholder="—"
                onChange={(event) =>
                  setValue({
                    hpCurrent:
                      event.target.value === ''
                        ? undefined
                        : Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </label>
            <label className="token-field">
              PV m&aacute;ximo
              <input
                type="number"
                min="0"
                value={selectedToken.hpMax ?? ''}
                placeholder="—"
                onChange={(event) =>
                  setValue({
                    hpMax:
                      event.target.value === ''
                        ? undefined
                        : Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </label>
          </div>
          <div className="token-field-row">
            <label className="token-field">
              Mana atual
              <input
                type="number"
                min="0"
                value={selectedToken.manaCurrent ?? ''}
                placeholder="—"
                onChange={(event) =>
                  setValue({
                    manaCurrent:
                      event.target.value === ''
                        ? undefined
                        : Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </label>
            <label className="token-field">
              Mana m&aacute;xima
              <input
                type="number"
                min="0"
                value={selectedToken.manaMax ?? ''}
                placeholder="—"
                onChange={(event) =>
                  setValue({
                    manaMax:
                      event.target.value === ''
                        ? undefined
                        : Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </label>
          </div>
          <section
            className={`token-sprites-section ${spritesExpanded ? 'is-expanded' : ''}`}
            aria-label="Sprites do token"
          >
            <button
              className="token-sprites-toggle"
              type="button"
              aria-expanded={spritesExpanded}
              onClick={() => setSpritesExpanded((value) => !value)}
            >
              Sprites <ChevronDown size={15} />
            </button>
            <div className="token-sprites-content">
              <span className="token-sprites-title">Sprites</span>
              <label className="token-field">
                Sprite ativo
                <select
                  value={activeSprite?.id ?? ''}
                  onChange={(event) => {
                    if (event.target.value)
                      selectTokenSprite(selectedToken.id, event.target.value)
                  }}
                >
                  {sprites.length === 0 && <option value="">Sem sprite</option>}
                  {sprites.map((sprite) => (
                    <option key={sprite.id} value={sprite.id}>
                      {sprite.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? [])
                  if (files.length) addTokenSprites(selectedToken.id, files)
                  event.currentTarget.value = ''
                }}
              />
              <button
                className="token-image-button"
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={15} /> Adicionar sprite
              </button>
              {activeSprite && (
                <>
                  <label className="token-field">
                    Rótulo
                    <input
                      type="text"
                      maxLength={40}
                      value={activeSprite.label}
                      onChange={(event) =>
                        renameTokenSprite(
                          selectedToken.id,
                          activeSprite.id,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <button
                    className="token-delete-button"
                    type="button"
                    onClick={() =>
                      removeTokenSprite(selectedToken.id, activeSprite.id)
                    }
                  >
                    <Trash2 size={15} /> Remover sprite
                  </button>
                </>
              )}
              <label className="token-flip-toggle">
                <input
                  type="checkbox"
                  checked={selectedToken.flipX}
                  onChange={(event) =>
                    setValue({ flipX: event.target.checked })
                  }
                />
                <span>Espelhar imagem</span>
              </label>
            </div>
          </section>
          <button
            className="token-delete-button"
            type="button"
            onClick={() => removeToken(selectedToken.id)}
          >
            <Trash2 size={15} /> Remover token
          </button>
        </CardContent>
      )}
    </Card>
  )
}
