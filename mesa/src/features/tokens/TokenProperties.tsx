import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Trash2, X } from 'lucide-react'
import { Card, CardContent } from '@mesa/components/ui/card'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { useUiStore } from '@mesa/stores/ui-store'
import type { Token } from '@mesa/features/tokens/token-types'
import type { TokenSprite } from '@mesa/features/tokens/token-types'
import { useBottomSheetDismiss } from '@mesa/hooks/use-bottom-sheet-dismiss'
import { isRoomMode } from '@mesa/features/rooms/room-commands'
import { useRoomStore } from '@mesa/features/rooms/room-store'
import { FichaDoToken } from '@mesa/features/tokens/FichaDoToken'
import { TAMANHO_MAXIMO, TAMANHO_MINIMO, alturaDoToken } from '@mesa/features/tokens/token-types'

const EMPTY_SPRITES: TokenSprite[] = []

const celulas = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'célula' : 'células'}`

export function TokenProperties({
  campanhaId,
  mobileOpen,
  onMobileClose,
}: {
  campanhaId: string
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
  const players = useRoomStore((state) => state.players)
  const playerKey = useRoomStore((state) => state.playerKey)
  const role = useRoomStore((state) => state.role)
  const mobileMode = mobileOpen !== undefined
  const contentVisible = mobileMode ? mobileOpen : !collapsed
  const dragHandlers = useBottomSheetDismiss(Boolean(mobileOpen), onMobileClose)

  if (!token) return null
  const selectedToken = token
  /* Com a ficha ligada, ela manda: o máximo vem dela, e só o mestre e o dono recebem e alteram os valores. */
  const linked = Boolean(selectedToken.characterId)
  const inRoom = isRoomMode()
  const canEdit =
    !inRoom ||
    role === 'gm' ||
    (role === 'player' &&
      !selectedToken.hidden &&
      Boolean(playerKey && selectedToken.ownerIds.includes(playerKey)))
  const isGM = !inRoom || role === 'gm'
  const canRemove =
    !inRoom ||
    role === 'gm' ||
    (role === 'player' &&
      selectedToken.createdByPlayerKey === playerKey &&
      !selectedToken.hidden)
  if (!canEdit) return null

  function setValue(changes: Partial<Omit<Token, 'id'>>) {
    updateToken(selectedToken.id, changes)
  }

  const activeSprite = sprites.find(
    (sprite) => sprite.id === selectedToken.activeSpriteId,
  )

  /* Largura e altura mudam separadas. Na grade, cada eixo se alinha pela própria medida. */
  function changeSize(changes: { size?: number; altura?: number }) {
    const grid = useUiStore.getState().grid
    if (!grid.enabled) {
      setValue(changes)
      return
    }
    const cellSize = grid.cellSize
    const snap = (value: number, size: number) =>
      (Math.round(value / cellSize - size / 2) + size / 2) * cellSize
    const size = changes.size ?? selectedToken.size
    const altura = changes.altura ?? alturaDoToken(selectedToken)
    setValue({ ...changes, x: snap(selectedToken.x, size), y: snap(selectedToken.y, altura) })
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
          {canRemove && (
            <button
              className="token-remove-icon"
              type="button"
              aria-label="Remover token"
              title="Remover token"
              onClick={() => removeToken(token.id)}
            >
              <X size={17} />
            </button>
          )}
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
          {isGM && (
            <label className="range-control">
              <span>Largura <b>{celulas(selectedToken.size)}</b></span>
              <input type="range" aria-label="Largura do token" min={TAMANHO_MINIMO} max={TAMANHO_MAXIMO} step="0.25" value={selectedToken.size}
                onChange={(event) => changeSize({ size: Number(event.target.value), altura: alturaDoToken(selectedToken) })} />
            </label>
          )}
          {isGM && (
            <label className="range-control">
              <span>Altura <b>{celulas(alturaDoToken(selectedToken))}</b></span>
              <input type="range" aria-label="Altura do token" min={TAMANHO_MINIMO} max={TAMANHO_MAXIMO} step="0.25" value={alturaDoToken(selectedToken)}
                onChange={(event) => changeSize({ altura: Number(event.target.value) })} />
            </label>
          )}
          {isGM && (
            <div className="token-field-row">
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
          )}
          {isGM && inRoom && (
            <>
              <label className="token-field">
                Jogadores donos
                <select
                  multiple
                  value={selectedToken.ownerIds}
                  onChange={(event) =>
                    setValue({
                      ownerIds: Array.from(
                        event.currentTarget.selectedOptions,
                        (option) => option.value,
                      ),
                    })
                  }
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="token-flip-toggle">
                <input
                  type="checkbox"
                  checked={selectedToken.hidden}
                  onChange={(event) => setValue({ hidden: event.target.checked })}
                />
                <span>Oculto para jogadores</span>
              </label>
            </>
          )}
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
                disabled={linked && selectedToken.hpCurrent === undefined}
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
                disabled={linked}
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
                disabled={linked && selectedToken.manaCurrent === undefined}
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
                disabled={linked}
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
          <FichaDoToken token={selectedToken} campanhaId={campanhaId} />
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
          {canRemove && (
            <button
              className="token-delete-button"
              type="button"
              onClick={() => removeToken(selectedToken.id)}
            >
              <Trash2 size={15} /> Remover token
            </button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
