const MAX_IMAGE_SIDE = 512
const MAX_DATA_URL_LENGTH = 680_000

export async function fileToRoomImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Este navegador não conseguiu processar a imagem.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.68, 0.54, 0.4, 0.28, 0.16]) {
      const dataUrl = canvas.toDataURL('image/webp', quality)
      if (
        dataUrl.startsWith('data:image/webp,') ||
        dataUrl.length <= MAX_DATA_URL_LENGTH
      )
        return dataUrl
    }
    throw new Error(
      'A imagem continua grande demais após a compressão (limite de 500 KB).',
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
