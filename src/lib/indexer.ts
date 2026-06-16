import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, getDecryptedKeys } from './gemini'
import { initUserDrive, writeJSON, findFile, readJSON, trashPDF, updateDocumentMetadata } from './drive'
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

function isRateLimit(e: unknown): boolean {
  const msg = String(e)
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests')
}

// Genera embeddings usando batchEmbedContents con rotación de keys en rate limit
export async function generateEmbeddings(
  chunks: string[],
  accessToken: string,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const keys = await getDecryptedKeys(accessToken)
  if (!keys.length) throw new Error('No hay API key configurada.')

  const BATCH_SIZE = 100
  const embeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const lote = chunks.slice(i, i + BATCH_SIZE)
    let lastError: unknown

    for (let ki = 0; ki < keys.length; ki++) {
      try {
        const genAI = new GoogleGenerativeAI(keys[ki])
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
        const result = await model.batchEmbedContents({
          requests: lote.map((text) => ({
            content: { parts: [{ text }], role: 'user' as const },
          })),
        })
        embeddings.push(...result.embeddings.map((e) => e.values))
        break
      } catch (e) {
        lastError = e
        if (isRateLimit(e) && ki < keys.length - 1) continue
        throw e
      }
    }

    if (embeddings.length <= i) throw lastError // all keys failed for this batch
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

// Elimina archivos de embeddings por documento y sincroniza con Vectorize
export async function removeFromIndex(accessToken: string, documentoIds: string[]): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  await Promise.allSettled(
    documentoIds.map(async (id) => {
      const fileId = await findFile(accessToken, `emb_${id}.json`, estructura.indexId)
      if (!fileId) return

      // Leer IDs de fragmentos antes de borrar el archivo
      if (vectorizeUrl && workerSecret) {
        try {
          const fragmentos = await readJSON<Fragmento[]>(accessToken, fileId)
          if (Array.isArray(fragmentos) && fragmentos.length > 0) {
            const ids = (fragmentos as Fragmento[]).map((f) => f.id)
            for (let i = 0; i < ids.length; i += 100) {
              await fetch(`${vectorizeUrl}/delete`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${workerSecret}`,
                },
                body: JSON.stringify({ ids: ids.slice(i, i + 100) }),
              })
            }
          }
        } catch (e) {
          console.error('[Vectorize] removeFromIndex failed:', e)
        }
      }

      await trashPDF(accessToken, fileId)
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
  // Solo si hay páginas vacías significativas: ≥5 abs. o ≥15% del doc.
  // Evita OCR en libros digitales con tapa/contratapa escaneadas.
  const MIN_EMPTY_FOR_OCR = 5
  const MIN_RATIO_FOR_OCR = 0.15
  const necesitaOCR =
    sinTexto.length >= MIN_EMPTY_FOR_OCR ||
    (total > 0 && sinTexto.length / total >= MIN_RATIO_FOR_OCR)

  if (sinTexto.length > 0 && necesitaOCR) {
    onProgress(
      `PDF con ${sinTexto.length} págs escaneadas (${Math.round(sinTexto.length / total * 100)}%). Aplicando OCR…`,
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
  } else if (sinTexto.length > 0) {
    onProgress(
      `${sinTexto.length} pág(s) sin texto (probable tapa/figura). Omitiendo OCR.`,
      2, TOTAL
    )
  }

  if (allChunks.length === 0) {
    throw new Error(
      sinTexto.length > 0
        ? `PDF totalmente escaneado y el OCR no pudo recuperar texto. Verificá los permisos de Google Drive o resubí el PDF.`
        : 'No se pudo extraer texto del PDF'
    )
  }

  onProgress(`Generando embeddings para ${allChunks.length} fragmentos…`, 3, TOTAL)
  const embeddings = await generateEmbeddings(
    allChunks.map((c) => c.texto),
    accessToken,
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

  // Sincronizar con Vectorize si está configurado (no bloquea la indexación si falla)
  // Vectorize soporta máx 1536 dims; truncamos desde 3072 (matryoshka — preserva semántica)
  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET
  if (vectorizeUrl && workerSecret) {
    try {
      const vectors = fragmentos.map((f) => ({
        id: f.id,
        values: f.embedding.slice(0, 1536),
        metadata: { documentoId: f.documentoId, texto: f.texto.slice(0, 500), pagina: f.pagina },
      }))
      for (let i = 0; i < vectors.length; i += 100) {
        await fetch(`${vectorizeUrl}/upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${workerSecret}`,
          },
          body: JSON.stringify({ vectors: vectors.slice(i, i + 100) }),
        })
      }
    } catch (e) {
      console.error('[Vectorize] indexDocument sync failed:', e)
    }
  }

  onProgress('Actualizando metadatos…', 5, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, {
    estado: 'indexado',
    fragmentos: fragmentos.length,
    indexadoEn: new Date().toISOString(),
  })

  return fragmentos.length
}
