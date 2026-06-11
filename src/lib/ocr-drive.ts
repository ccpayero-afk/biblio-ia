// OCR usando la conversión PDF→Google Doc de la API de Drive.
// No consume tokens de IA — usa la cuota gratuita de Google Drive del usuario.
// Google exporta el texto con \f (form feed) como separador de páginas.
export async function ocrWithGoogleDrive(
  accessToken: string,
  pdfBuffer: Buffer
): Promise<string[]> {
  const boundary = `biblio_ocr_${Date.now()}`

  const metaJson = JSON.stringify({
    name: `_ocr_tmp_${Date.now()}`,
    mimeType: 'application/vnd.google-apps.document',
  })

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(50000),
    }
  )

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`OCR Google Drive: error al subir (${uploadRes.status}) ${err.slice(0, 150)}`)
  }

  const { id: docId } = (await uploadRes.json()) as { id: string }

  try {
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!exportRes.ok) throw new Error(`OCR Google Drive: error al exportar (${exportRes.status})`)

    const fullText = await exportRes.text()
    // \f (U+000C) es el separador de páginas que usa Google Docs al exportar
    return fullText.split('\f').map((p) => p.trim())
  } finally {
    // Borrar el doc temporal (best effort, no bloqueante)
    fetch(`https://www.googleapis.com/drive/v3/files/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {})
  }
}
