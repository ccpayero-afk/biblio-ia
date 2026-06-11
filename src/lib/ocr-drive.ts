import { google } from 'googleapis'
import { Readable } from 'stream'

function getDrive(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

// OCR usando la conversión PDF→Google Doc de la API de Drive.
// No consume tokens de IA — usa la cuota gratuita de Google Drive del usuario.
export async function ocrWithGoogleDrive(
  accessToken: string,
  pdfBuffer: Buffer
): Promise<string[]> {
  const drive = getDrive(accessToken)

  // 1. Subir PDF como Google Doc — Drive aplica OCR automáticamente
  const uploadRes = await drive.files.create({
    requestBody: {
      name: `_ocr_tmp_${Date.now()}`,
      mimeType: 'application/vnd.google-apps.document',
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    fields: 'id',
  })

  const docId = uploadRes.data.id
  if (!docId) throw new Error('Google OCR: no se pudo crear el documento temporal')

  try {
    // 2. Exportar como texto plano (Google usa \f como separador de páginas)
    const exportRes = await drive.files.export(
      { fileId: docId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' }
    )
    const fullText = Buffer.from(exportRes.data as ArrayBuffer).toString('utf-8')
    return fullText.split('\f').map((p) => p.trim())
  } finally {
    // 3. Borrar el doc temporal (best effort, no bloqueante)
    drive.files.delete({ fileId: docId }).catch(() => {})
  }
}
