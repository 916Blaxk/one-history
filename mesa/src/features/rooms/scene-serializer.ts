const MAX_SCENE_SIDE = 3072
const MAX_SCENE_DATA_URL_LENGTH = 920_000

export async function fileToRoomScene(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const initialScale = Math.min(
      1,
      MAX_SCENE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Este navegador não conseguiu processar o cenário.')

    for (const sizeScale of [1, 0.8, 0.65, 0.5, 0.4, 0.3, 0.2, 0.15]) {
      canvas.width = Math.max(
        1,
        Math.round(image.naturalWidth * initialScale * sizeScale),
      )
      canvas.height = Math.max(
        1,
        Math.round(image.naturalHeight * initialScale * sizeScale),
      )
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.84, 0.74, 0.64, 0.54, 0.44]) {
        const dataUrl = canvas.toDataURL('image/webp', quality)
        if (
          (dataUrl.startsWith('data:image/webp;base64,') ||
            dataUrl.startsWith('data:image/png;base64,')) &&
          dataUrl.length <= MAX_SCENE_DATA_URL_LENGTH
        )
          return dataUrl
      }
    }
    throw new Error(
      'O cenário continua grande demais após a compressão. Tente uma imagem menor.',
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
