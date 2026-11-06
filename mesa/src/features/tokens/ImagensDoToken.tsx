import { useRef, useState } from 'react'
import { Crop, ImagePlus, Swords, Trash2 } from 'lucide-react'
import AjusteFoto, { arquivoDaTela, arquivoDeDataUrl } from '@/components/AjusteFoto'
import { LIMITE_ORIGINAL } from '@/lib/regras'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { idDaVaga, type AjusteImagem, type Token, type TokenSprite, type VagaImagem } from '@mesa/features/tokens/token-types'

const EMPTY_SPRITES: TokenSprite[] = []
/* O maior lado que o servidor aceita para a imagem de um token. */
const MAIOR_LADO_DO_TOKEN = 512
const VAGAS: { vaga: VagaImagem; rotulo: string; dica: string }[] = [
  { vaga: 'normal', rotulo: 'Normal', dica: 'A imagem do dia a dia.' },
  { vaga: 'machucado', rotulo: 'Machucado', dica: 'Aparece sozinha abaixo da metade da vida.' },
  { vaga: 'armado', rotulo: 'Armado', dica: 'Aparece com o botão Armado ligado.' },
]

export function ImagensDoToken({ token }: { token: Token }) {
  const sprites = useTokenStore((state) => state.spritesByTokenId[token.id] ?? EMPTY_SPRITES)
  const definirImagem = useTokenStore((state) => state.definirImagem)
  const removeTokenSprite = useTokenStore((state) => state.removeTokenSprite)
  const updateToken = useTokenStore((state) => state.updateToken)
  const arquivos = useRef<Partial<Record<VagaImagem, HTMLInputElement | null>>>({})
  const pedirOriginal = useTokenStore((state) => state.pedirOriginal)
  const [escolha, setEscolha] = useState<{ vaga: VagaImagem; rotulo: string; arquivo: File; original?: string; ajuste?: AjusteImagem } | null>(null)
  const imagemDaVaga = (vaga: VagaImagem) => sprites.find((sprite) => sprite.id === idDaVaga(token, vaga))

  async function reajustar(vaga: VagaImagem, rotulo: string, imagem: TokenSprite) {
    const guardado = await pedirOriginal(token.id, imagem.id)
    if (guardado?.imagem && guardado.ajuste) {
      setEscolha({ vaga, rotulo, arquivo: arquivoDeDataUrl(guardado.imagem, rotulo), original: guardado.imagem, ajuste: guardado.ajuste })
      return
    }
    /* Imagem antiga, sem original: parte dela mesma, com o fundo já retirado. */
    setEscolha({ vaga, rotulo, arquivo: arquivoDeDataUrl(imagem.imageUrl, rotulo), original: imagem.imageUrl.length <= LIMITE_ORIGINAL ? imagem.imageUrl : undefined, ajuste: { zoom: 1, x: 0, y: 0, forca: 0 } })
  }

  return (
    <section className="token-sprites-section" aria-label="Imagens do token">
      <span className="token-sprites-title">Imagens do token</span>
      <div className="imagens-token">
        {VAGAS.map(({ vaga, rotulo, dica }) => {
          const imagem = imagemDaVaga(vaga)
          return (
            <div className="vaga-imagem" key={vaga}>
              <button type="button" className="vaga-imagem-botao" title={dica} aria-label={`${imagem ? 'Trocar' : 'Adicionar'} imagem ${rotulo}. ${dica}`} onClick={() => arquivos.current[vaga]?.click()}>
                {imagem ? <img src={imagem.imageUrl} alt={`Imagem ${rotulo} atual`} /> : <ImagePlus size={20} aria-hidden="true" />}
              </button>
              <span>{rotulo}</span>
              {imagem && (
                <div className="vaga-imagem-acoes">
                  <button type="button" aria-label={`Ajustar imagem ${rotulo}`} title={`Ajustar imagem ${rotulo}`} onClick={() => void reajustar(vaga, rotulo, imagem)}>
                    <Crop size={13} />
                  </button>
                  <button type="button" aria-label={`Remover imagem ${rotulo}`} title={`Remover imagem ${rotulo}`} onClick={() => removeTokenSprite(token.id, imagem.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
              <input
                ref={(el) => { arquivos.current[vaga] = el }}
                className="visually-hidden"
                type="file"
                accept="image/*"
                aria-label={`Arquivo da imagem ${rotulo}`}
                onChange={(event) => {
                  const arquivo = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (arquivo) setEscolha({ vaga, rotulo, arquivo })
                }}
              />
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className={`token-armado ${token.armado ? 'is-active' : ''}`}
        aria-pressed={Boolean(token.armado)}
        disabled={!token.spriteArmadoId}
        title={token.spriteArmadoId ? 'Mostrar a imagem Armado' : 'Coloque antes uma imagem Armado'}
        onClick={() => updateToken(token.id, { armado: !token.armado })}
      >
        <Swords size={15} /> Armado
      </button>
      <label className="token-flip-toggle">
        <input type="checkbox" checked={token.flipX} onChange={(event) => updateToken(token.id, { flipX: event.target.checked })} />
        <span>Espelhar imagem</span>
      </label>
      {escolha && (
        <AjusteFoto
          key={`${escolha.vaga}-${escolha.arquivo.name}-${escolha.arquivo.lastModified}`}
          arquivo={escolha.arquivo}
          titulo={`Ajustar a imagem ${escolha.rotulo}`}
          maiorLado={MAIOR_LADO_DO_TOKEN}
          comRetiradaDeFundo
          comOriginal={!escolha.original}
          salvo={escolha.ajuste}
          forcaSalva={escolha.ajuste?.forca}
          aoCancelar={() => setEscolha(null)}
          aoFalhar={() => { setEscolha(null); window.alert('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.') }}
          aoSalvar={(tela, { ajuste, forca, original }) => {
            const { vaga, rotulo, arquivo, original: jaGuardado } = escolha
            setEscolha(null)
            /* Ao reajustar, mantém o original que já existe: recomprimir a cada ajuste iria piorando a imagem. */
            void arquivoDaTela(tela, arquivo.name).then((pronto) => definirImagem(token.id, vaga, rotulo, pronto, { imagem: jaGuardado ?? original, ajuste: { ...ajuste, forca } }))
          }}
        />
      )}
    </section>
  )
}
