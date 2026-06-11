import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, getGeminiClient } from './gemini'
import { initUserDrive, writeJSON, findFile, trashPDF, updateDocumentMetadata } from './drive'
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

// Genera embeddings en lotes de 20 para respetar rate limits
export async function generateEmbeddings(
  chunks: string[],
  genAI: GoogleGenerativeAI,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
  const BATCH_SIZE = 20
  const embeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const lote = chunks.slice(i, i + BATCH_SIZE)
    const resultados = await Promise.all(
      lote.map((texto) => model.embedContent(texto).then((r) => r.embedding.values))
    )
    embeddings.push(...resultados)
    onProgress?.(Math.min(i + BATCH_SIZE, chunks.length), chunks.length)
    if (i + BATCH_SIZE < chunks.length) await new Promise((r) => setTimeout(r, 500))
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

  const rawChunks = conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))

  if (rawChunks.length === 0) {
    if (sinTexto.length > 0) {
      throw new Error(
        `PDF escaneado: ${sinTexto.length} de ${total} páginas no tienen texto seleccionable. ` +
        `Convertí el PDF a texto con Adobe Acrobat, Google Drive (abrir como Docs) u otra herramienta y volvé a subirlo.`
      )
    }
    throw new Error('No se pudo extraer texto del PDF')
  }

  if (sinTexto.length > 0) {
    onProgress(
      `Texto extraído (${conTexto.length} págs con texto, ${sinTexto.length} págs escaneadas omitidas)`,
      2, TOTAL
    )
  }

  onProgress(`Generando embeddings para ${rawChunks.length} fragmentos…`, 3, TOTAL)
  const genAI = await getGeminiClient(accessToken)
  const embeddings = await generateEmbeddings(
    rawChunks.map((c) => c.texto),
    genAI,
    (done, total) => onProgress(`Embeddings: ${done}/${total}…`, 3, TOTAL)
  )

  onProgress('Guardando índice en Drive…', 4, TOTAL)
  const fragmentos: Fragmento[] = rawChunks.map((c, i) => ({
    id: `${documentoId}_${i}`,
    documentoId,
    texto: c.texto,
    pagina: c.pagina,
    embedding: embeddings[i],
  }))

  const estructura = await initUserDrive(accessToken)
  await writeJSON(accessToken, estructura.indexId, `emb_${documentoId}.json`, fragmentos)

  onProgress('Actualizando metadatos…', 5, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, {
    estado: 'indexado',
    fragmentos: fragmentos.length,
    indexadoEn: new Date().toISOString(),
  })

  return fragmentos.length
}
