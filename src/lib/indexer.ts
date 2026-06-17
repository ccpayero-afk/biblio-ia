import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_EMBEDDING, getDecryptedKeys } from './gemini'
import {
  initUserDrive,
  writeJSON,
  findFile,
  readJSON,
  trashPDF,
  updateDocumentMetadata,
  getDocumentMetadata,
  listFilesInFolder,
} from './drive'
import { ocrWithGoogleDrive } from './ocr-drive'
import { Fragmento } from '@/types'

const MIN_PAGE_CHARS = 30

// ── Checkpoint ────────────────────────────────────────────────────────────────

interface IndexCheckpoint {
  documentoId: string
  fase: 'extraccion' | 'embeddings' | 'guardado'
  chunksTotal: number
  chunksCompletados: number
  embeddingsParciales: Array<{ texto: string; pagina: number; embedding: number[] }>
  iniciadoEn: string
  actualizadoEn: string
}

const CHECKPOINT_STUCK_MS = 10 * 60 * 1000 // 10 minutos

export async function checkAndRecoverStuckDocs(accessToken: string): Promise<void> {
  try {
    const estructura = await initUserDrive(accessToken)
    const chkFiles = await listFilesInFolder(accessToken, estructura.indexId, 'chk_')
    const now = Date.now()
    await Promise.allSettled(
      chkFiles.map(async (f) => {
        try {
          const chk = await readJSON<IndexCheckpoint>(accessToken, f.id)
          if (now - new Date(chk.actualizadoEn).getTime() > CHECKPOINT_STUCK_MS) {
            await updateDocumentMetadata(accessToken, chk.documentoId, { estado: 'error' })
            await trashPDF(accessToken, f.id)
          }
        } catch { /* archivo ilegible — ignorar */ }
      })
    )
  } catch { /* no bloquear la indexación si falla el recovery */ }
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

export async function downloadPDFBuffer(accessToken: string, fileId: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Error al descargar PDF: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

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

export async function extractChunks(buffer: Buffer): Promise<{ texto: string; pagina: number }[]> {
  const { conTexto } = await extractAllPageTexts(buffer)
  return conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))
}

// ── Embeddings ────────────────────────────────────────────────────────────────

function isRateLimit(e: unknown): boolean {
  const msg = String(e)
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests')
}

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

    if (embeddings.length <= i) throw lastError
    onProgress?.(Math.min(i + BATCH_SIZE, chunks.length), chunks.length)
  }

  return embeddings
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] ** 2
    normB += b[i] ** 2
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
}

// ── Vectorize sync helpers ────────────────────────────────────────────────────

const VECTORIZE_DIMS = 1536  // Vectorize máx; gemini-embedding-2 genera 3072 (matryoshka)
const VECTORIZE_BATCH = 100

async function syncToVectorize(
  fragmentos: Fragmento[],
  docMeta: { nombre: string; autor: string; año: string }
): Promise<void> {
  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET
  if (!vectorizeUrl || !workerSecret) return

  const vectors = fragmentos.map((f) => ({
    id: f.id,
    values: f.embedding.slice(0, VECTORIZE_DIMS),
    metadata: {
      documentoId: f.documentoId,
      texto: f.texto.slice(0, 1000),
      pagina: f.pagina,
      documentoNombre: docMeta.nombre,
      autor: docMeta.autor,
      año: docMeta.año,
    },
  }))

  for (let i = 0; i < vectors.length; i += VECTORIZE_BATCH) {
    await fetch(`${vectorizeUrl}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
      body: JSON.stringify({ vectors: vectors.slice(i, i + VECTORIZE_BATCH) }),
    })
  }
}

// ── removeFromIndex ───────────────────────────────────────────────────────────

export async function removeFromIndex(accessToken: string, documentoIds: string[]): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  await Promise.allSettled(
    documentoIds.map(async (id) => {
      // Sincronizar eliminación con Vectorize via /delete-by-doc
      if (vectorizeUrl && workerSecret) {
        try {
          await fetch(`${vectorizeUrl}/delete-by-doc`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
            body: JSON.stringify({ documentoId: id }),
          })
        } catch (e) {
          console.error('[Vectorize] removeFromIndex failed:', e)
        }
      }

      const fileId = await findFile(accessToken, `emb_${id}.json`, estructura.indexId)
      if (fileId) await trashPDF(accessToken, fileId)

      // Borrar checkpoint si existe
      const chkId = await findFile(accessToken, `chk_${id}.json`, estructura.indexId)
      if (chkId) await trashPDF(accessToken, chkId)
    })
  )
}

// ── indexDocument — pipeline completo con checkpointing ──────────────────────

export async function indexDocument(
  documentoId: string,
  accessToken: string,
  onProgress: (msg: string, paso: number, total: number) => void
): Promise<number> {
  const TOTAL = 5

  // Recovery de docs atascados (fire-and-forget)
  checkAndRecoverStuckDocs(accessToken).catch(() => {})

  onProgress('Descargando PDF desde Drive…', 1, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, { estado: 'indexando' })

  const estructura = await initUserDrive(accessToken)

  // ── Verificar checkpoint existente ────────────────────────────────────────
  const chkFileName = `chk_${documentoId}.json`
  const chkFileId = await findFile(accessToken, chkFileName, estructura.indexId)
  let checkpoint: IndexCheckpoint | null = null

  if (chkFileId) {
    try {
      const chk = await readJSON<IndexCheckpoint>(accessToken, chkFileId)
      if (chk.fase !== 'guardado') {
        checkpoint = chk
        onProgress(
          `Reanudando indexación desde fragmento ${chk.chunksCompletados}/${chk.chunksTotal}…`,
          3, TOTAL
        )
      }
    } catch { /* checkpoint corrupto — empezar de cero */ }
  }

  // ── Fase 1+2: extracción (si no hay checkpoint) ───────────────────────────
  let allChunks: { texto: string; pagina: number }[]
  let textosPorPagina: Record<number, string>

  if (!checkpoint) {
    const buffer = await downloadPDFBuffer(accessToken, documentoId)

    onProgress('Extrayendo texto del PDF…', 2, TOTAL)
    const { conTexto, sinTexto, total } = await extractAllPageTexts(buffer)

    allChunks = conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))
    textosPorPagina = {}
    for (const { texto, pagina } of conTexto) textosPorPagina[pagina] = texto

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
        onProgress(`OCR completado: ${ocrAdded}/${sinTexto.length} págs recuperadas`, 2, TOTAL)
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
          ? 'PDF totalmente escaneado y el OCR no pudo recuperar texto.'
          : 'No se pudo extraer texto del PDF'
      )
    }

    // Crear checkpoint inicial
    const now = new Date().toISOString()
    checkpoint = {
      documentoId,
      fase: 'embeddings',
      chunksTotal: allChunks.length,
      chunksCompletados: 0,
      embeddingsParciales: [],
      iniciadoEn: now,
      actualizadoEn: now,
    }
    await writeJSON(accessToken, estructura.indexId, chkFileName, checkpoint)
  } else {
    // Restaurar chunks desde checkpoint — descargamos el PDF de nuevo para tener los chunks
    const buffer = await downloadPDFBuffer(accessToken, documentoId)
    const { conTexto, sinTexto } = await extractAllPageTexts(buffer)
    allChunks = conTexto.flatMap(({ texto, pagina }) => chunkText(texto, pagina))
    textosPorPagina = {}
    for (const { texto, pagina } of conTexto) textosPorPagina[pagina] = texto
    // Incluir OCR si corresponde (simplificado en reanudación — solo texto embebido)
    for (const pageNum of sinTexto) {
      const ocrText = ''  // no re-OCR en reanudación para evitar re-pagar
      if (ocrText) allChunks.push(...chunkText(ocrText, pageNum))
    }
  }

  // ── Fase 3: embeddings con checkpointing por lote ─────────────────────────
  onProgress(`Generando embeddings para ${allChunks.length} fragmentos…`, 3, TOTAL)

  const keys = await getDecryptedKeys(accessToken)
  if (!keys.length) throw new Error('No hay API key configurada.')

  const BATCH_SIZE = 100
  const embeddingsParciales = [...(checkpoint?.embeddingsParciales ?? [])]
  const startIdx = embeddingsParciales.length  // reanudar desde aquí

  for (let i = startIdx; i < allChunks.length; i += BATCH_SIZE) {
    const lote = allChunks.slice(i, i + BATCH_SIZE)
    let lastError: unknown

    for (let ki = 0; ki < keys.length; ki++) {
      try {
        const genAI = new GoogleGenerativeAI(keys[ki])
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
        const result = await model.batchEmbedContents({
          requests: lote.map((c) => ({
            content: { parts: [{ text: c.texto }], role: 'user' as const },
          })),
        })
        for (let j = 0; j < lote.length; j++) {
          embeddingsParciales.push({
            texto: lote[j].texto,
            pagina: lote[j].pagina,
            embedding: result.embeddings[j].values,
          })
        }
        break
      } catch (e) {
        lastError = e
        if (isRateLimit(e) && ki < keys.length - 1) continue
        throw e
      }
    }

    if (embeddingsParciales.length <= i) throw lastError

    // Actualizar checkpoint después de cada lote
    const updatedChk: IndexCheckpoint = {
      ...checkpoint!,
      chunksCompletados: embeddingsParciales.length,
      embeddingsParciales,
      actualizadoEn: new Date().toISOString(),
    }
    await writeJSON(accessToken, estructura.indexId, chkFileName, updatedChk)
    onProgress(`Embeddings: ${embeddingsParciales.length}/${allChunks.length}…`, 3, TOTAL)
  }

  // ── Fase 4: guardar ───────────────────────────────────────────────────────
  onProgress('Guardando índice en Drive…', 4, TOTAL)

  const fragmentos: Fragmento[] = embeddingsParciales.map((ep, i) => ({
    id: `${documentoId}_${i}`,
    documentoId,
    texto: ep.texto,
    pagina: ep.pagina,
    embedding: ep.embedding,
  }))

  await Promise.all([
    writeJSON(accessToken, estructura.indexId, `emb_${documentoId}.json`, fragmentos),
    writeJSON(accessToken, estructura.indexId, `txt_${documentoId}.json`, textosPorPagina),
  ])

  // Borrar checkpoint — indexación exitosa
  const chkIdFinal = await findFile(accessToken, chkFileName, estructura.indexId)
  if (chkIdFinal) await trashPDF(accessToken, chkIdFinal)

  // Sincronizar con Vectorize (no bloquea si falla)
  try {
    const docMeta = await getDocumentMetadata(accessToken, documentoId)
    await syncToVectorize(fragmentos, docMeta)
  } catch (e) {
    console.error('[Vectorize] indexDocument sync failed:', e)
  }

  onProgress('Actualizando metadatos…', 5, TOTAL)
  await updateDocumentMetadata(accessToken, documentoId, {
    estado: 'indexado',
    fragmentos: fragmentos.length,
    indexadoEn: new Date().toISOString(),
  })

  return fragmentos.length
}
