import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, GEMINI_MODEL_GENERATION, getGeminiClient } from './gemini'
import { initUserDrive, writeJSON, findFile, readJSON, updateDocumentMetadata } from './drive'
import { Fragmento } from '@/types'

const MIN_PAGE_CHARS = 30    // below this, page is considered empty/scanned
const OCR_THRESHOLD = 0.3   // if >30% of pages have no text → treat as scanned
const MAX_OCR_PAGES = 80    // cap to avoid streaming timeout
const OCR_BATCH = 3         // pages in parallel per Gemini batch

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

// OCR de una página: render a PNG → Gemini Vision → texto
async function ocrPage(buffer: Buffer, pageNumber: number, genAI: GoogleGenerativeAI): Promise<string> {
  const { renderPageAsImage } = await import('unpdf')
  const imageBuffer = await renderPageAsImage(new Uint8Array(buffer), pageNumber, { scale: 1.5 })
  const base64 = Buffer.from(imageBuffer).toString('base64')

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/png', data: base64 } },
    {
      text: 'Transcribí todo el texto visible en esta página de libro escaneado. Devolvé únicamente el texto transcrito, sin comentarios, encabezados ni explicaciones adicionales.',
    },
  ])
  return result.response.text().trim()
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

  let rawChunks = conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))

  // ── OCR automático si el PDF está escaneado ──────────────────────────────
  const fraccionSinTexto = total > 0 ? sinTexto.length / total : 0
  const esEscaneado = fraccionSinTexto >= OCR_THRESHOLD && sinTexto.length > 0

  if (esEscaneado) {
    const paginasAOCR = sinTexto.slice(0, MAX_OCR_PAGES)
    const totalOCR = paginasAOCR.length

    onProgress(
      `PDF escaneado detectado (${sinTexto.length}/${total} págs sin texto). Iniciando OCR…`,
      2, TOTAL
    )

    // Obtenemos el cliente Gemini antes del bucle
    const genAI = await getGeminiClient(accessToken)
    const chunksPorOCR: { texto: string; pagina: number }[] = []

    for (let i = 0; i < paginasAOCR.length; i += OCR_BATCH) {
      const lote = paginasAOCR.slice(i, i + OCR_BATCH)
      const progActual = Math.min(i + OCR_BATCH, totalOCR)
      onProgress(`OCR ${progActual}/${totalOCR} páginas…`, 2, TOTAL)

      const resultados = await Promise.all(
        lote.map(async (pagina) => {
          try {
            const texto = await ocrPage(buffer, pagina, genAI)
            return texto.length > 20 ? { texto, pagina } : null
          } catch {
            return null  // skip pages that fail OCR silently
          }
        })
      )

      for (const r of resultados) {
        if (r) chunksPorOCR.push(...chunkText(r.texto, r.pagina))
      }

      if (i + OCR_BATCH < paginasAOCR.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    rawChunks = [...rawChunks, ...chunksPorOCR]

    if (paginasAOCR.length < sinTexto.length) {
      onProgress(
        `OCR completado (${paginasAOCR.length} págs procesadas, ${sinTexto.length - paginasAOCR.length} omitidas por límite)`,
        2, TOTAL
      )
    }
  }

  if (rawChunks.length === 0) {
    throw new Error(
      esEscaneado
        ? 'No se pudo extraer texto del PDF escaneado (OCR sin resultados)'
        : 'No se pudo extraer texto del PDF'
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
  const embeddingsFileId = await findFile(accessToken, 'embeddings.json', estructura.indexId)
  let todos: Fragmento[] = []
  if (embeddingsFileId) {
    try {
      todos = await readJSON<Fragmento[]>(accessToken, embeddingsFileId)
      todos = todos.filter((f) => f.documentoId !== documentoId)
    } catch { todos = [] }
  }
  todos.push(...fragmentos)
  await writeJSON(accessToken, estructura.indexId, 'embeddings.json', todos)

  onProgress('Actualizando metadatos…', 5, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, {
    estado: 'indexado',
    fragmentos: fragmentos.length,
    indexadoEn: new Date().toISOString(),
  })

  return fragmentos.length
}
