import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, getGeminiClient } from './gemini'
import { initUserDrive, writeJSON, findFile, readJSON, updateDocumentMetadata } from './drive'
import { Fragmento } from '@/types'

// Descarga el PDF desde Drive como Buffer
async function downloadPDFBuffer(accessToken: string, fileId: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Error al descargar PDF: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

// Extrae texto por página usando pdf-parse v2
async function extractPageTexts(buffer: Buffer): Promise<{ texto: string; pagina: number }[]> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText()
  await parser.destroy()

  return result.pages
    .filter((p) => p.text.trim().length > 20)
    .map((p) => ({ texto: p.text.trim(), pagina: p.num }))
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

// Extrae todos los fragmentos del PDF
export async function extractChunks(buffer: Buffer): Promise<{ texto: string; pagina: number }[]> {
  const paginas = await extractPageTexts(buffer)
  return paginas.flatMap(({ texto, pagina }) => chunkText(texto, pagina))
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
  const rawChunks = await extractChunks(buffer)
  if (rawChunks.length === 0) throw new Error('No se pudo extraer texto del PDF')

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
