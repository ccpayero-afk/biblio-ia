import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, getGeminiClient } from './gemini'
import { initUserDrive, writeJSON, findFile, trashPDF, updateDocumentMetadata } from './drive'
import { ocrWithGoogleDrive } from './ocr-drive'
import { Fragmento } from '@/types'

const MIN_PAGE_CHARS = 30    // below this, page is considered empty/scanned

// Descarga el PDF desde Drive como Buffer
export async function downloadPDFBuffer(accessToken: string, fileId: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Error al descargar PDF: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

// Extrae texto de todas las páginas — devuelve cuáles tienen texto y cuáles no
async function extractAllPageTexts(buffer: Buffer): Promise<{
  conTexto: { texto: string; pagina: number }[]
  sinTexto: number[]
  total: number
}> {
  const { extractText } = await import('unpdf')
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]

  const conTexto: { texto: string; pagina: number }[] = []
  const sinTexto: number[] = []

  for (let i = 0; i < pages.length; i++) {
    const t = (pages[i] ?? '').trim()
    if (t.length >= MIN_PAGE_CHARS) {
      conTexto.push({ texto: t, pagina: i + 1 })
    } else {
      sinTexto.push(i + 1)
    }
  }

  return { conTexto, sinTexto, total: pages.length }
}

// Divide texto en fragmentos de ~400 palabras con overlap de 50
function chunkText(texto: string, pagina: number): { texto: string; pagina: number }[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const CHUNK_SIZE = 400
  const OVERLAP = 50
  const chunks: { texto: string; pagina: number }[] = []

  for (let i = 0; i < palabras.length; i += CHUNK_SIZE - OVERLAP) {
    const slice = palabras.slice(i, i + CHUNK_SIZE).join(' ')
    if (slice.length > 50) chunks.push({ texto: slice, pagina })
  }

  return chunks
}

// Extrae todos los fragmentos del PDF (sin OCR — solo texto embebido)
export async function extractChunks(buffer: Buffer): Promise<{ texto: string; pagina: number }[]> {
  const { conTexto } = await extractAllPageTexts(buffer)
  return conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))
}

// Genera embeddings usando batchEmbedContents (hasta 100 textos por llamada)
export async function generateEmbeddings(
  chunks: string[],
  genAI: GoogleGenerativeAI,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
  const BATCH_SIZE = 100
  const embeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const lote = chunks.slice(i, i + BATCH_SIZE)
    const result = await model.batchEmbedContents({
      requests: lote.map((text) => ({
        content: { parts: [{ text }], role: 'user' as const },
      })),
    })
    embeddings.push(...result.embeddings.map((e) => e.values))
    onProgress?.(Math.min(i + BATCH_SIZE, chunks.length), chunks.length)
  }

  return embeddings
}

// Similitud coseno entre dos vectores
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] ** 2
    normB += b[i] ** 2
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
}

// Elimina archivos de embeddings por documento
export async function removeFromIndex(accessToken: string, documentoIds: string[]): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  await Promise.allSettled(
    documentoIds.map(async (id) => {
      const fileId = await findFile(accessToken, `emb_${id}.json`, estructura.indexId)
      if (fileId) await trashPDF(accessToken, fileId)
    })
  )
}

// Pipeline completo de indexación con callback de progreso
export async function indexDocument(
  documentoId: string,
  accessToken: string,
  onProgress: (msg: string, paso: number, total: number) => void
): Promise<number> {
  const TOTAL = 5

  onProgress('Descargando PDF desde Drive…', 1, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, { estado: 'indexando' })
  const buffer = await downloadPDFBuffer(accessToken, documentoId)

  onProgress('Extrayendo texto del PDF…', 2, TOTAL)
  const { conTexto, sinTexto, total } = await extractAllPageTexts(buffer)

  const allChunks = conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))

  // Mapa página → texto completo (se guarda para búsqueda en el lector)
  const textosPorPagina: Record<number, string> = {}
  for (const { texto, pagina } of conTexto) {
    textosPorPagina[pagina] = texto
  }

  // ── OCR automático via Google Drive si hay páginas escaneadas ───────────────
  if (sinTexto.length > 0) {
    onProgress(
      `PDF con ${sinTexto.length} págs escaneadas. Aplicando OCR con Google Drive…`,
      2, TOTAL
    )
    try {
      const ocrPages = await ocrWithGoogleDrive(accessToken, buffer)
      let ocrAdded = 0
      for (const pageNum of sinTexto) {
        const ocrText = (ocrPages[pageNum - 1] ?? '').trim()
        if (ocrText.length > 20) {
          allChunks.push(...chunkText(ocrText, pageNum))
          textosPorPagina[pageNum] = ocrText
          ocrAdded++
        }
      }
      onProgress(
        `OCR completado: ${ocrAdded}/${sinTexto.length} págs recuperadas`,
        2, TOTAL
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 100) : 'error'
      onProgress(`OCR falló (${msg}). Indexando solo págs con texto…`, 2, TOTAL)
    }
  }

  if (allChunks.length === 0) {
    throw new Error(
      sinTexto.length > 0
        ? `PDF totalmente escaneado y el OCR no pudo recuperar texto. Verificá los permisos de Google Drive o resubí el PDF.`
        : 'No se pudo extraer texto del PDF'
    )
  }

  onProgress(`Generando embeddings para ${allChunks.length} fragmentos…`, 3, TOTAL)
  const genAI = await getGeminiClient(accessToken)
  const embeddings = await generateEmbeddings(
    allChunks.map((c) => c.texto),
    genAI,
    (done, total) => onProgress(`Embeddings: ${done}/${total}…`, 3, TOTAL)
  )

  onProgress('Guardando índice en Drive…', 4, TOTAL)
  const fragmentos: Fragmento[] = allChunks.map((c, i) => ({
    id: `${documentoId}_${i}`,
    documentoId,
    texto: c.texto,
    pagina: c.pagina,
    embedding: embeddings[i],
  }))

  const estructura = await initUserDrive(accessToken)
  await Promise.all([
    writeJSON(accessToken, estructura.indexId, `emb_${documentoId}.json`, fragmentos),
    writeJSON(accessToken, estructura.indexId, `txt_${documentoId}.json`, textosPorPagina),
  ])

  onProgress('Actualizando metadatos…', 5, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, {
    estado: 'indexado',
    fragmentos: fragmentos.length,
    indexadoEn: new Date().toISOString(),
  })

  return fragmentos.length
}
