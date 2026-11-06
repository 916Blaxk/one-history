import { useRef, useState } from 'react'
import { ImagePlus, Swords, Trash2 } from 'lucide-react'
import AjusteFoto, { arquivoDaTela } from '@/components/AjusteFoto'
import { useTokenStore } from '@mesa/features/tokens/token-store'
import { idDaVaga, type Token, type TokenSprite, type VagaImagem } from '@mesa/features/tokens/token-types'

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
  const [escolha, setEscolha] = useState<{ vaga: VagaImagem; rotulo: string; arquivo: File } | null>(null)
  const imagemDaVaga = (vaga: VagaImagem) => sprites.find((sprite) => sprite.id === idDaVaga(token, vaga))

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
                <button type="button" className="vaga-imagem-remover" aria-label={`Remover imagem ${rotulo}`} title={`Remover imagem ${rotulo}`} onClick={() => removeTokenSprite(token.id, imagem.id)}>
                  <Trash2 size={13} />
                </button>
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
          aoCancelar={() => setEscolha(null)}
          aoFalhar={() => { setEscolha(null); window.alert('Não consegui ler essa imagem. Use um arquivo JPG, PNG ou WebP.') }}
          aoSalvar={(tela) => {
            const { vaga, rotulo, arquivo } = escolha
            setEscolha(null)
            void arquivoDaTela(tela, arquivo.name).then((pronto) => definirImagem(token.id, vaga, rotulo, pronto))
          }}
        />
      )}
    </section>
  )
}
