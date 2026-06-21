import { Fragmento, Documento } from '@/types'
import { initUserDrive, findFile, readJSON, listPDFs, listFilesInFolder } from './drive'
// listPDFs is used only by the Drive fallback path below
import { generateWithRotation, GEMINI_MODEL_EMBEDDING } from './gemini'
import { cosineSimilarity } from './indexer'

export interface FragmentoConDocumento extends Fragmento {
  documentoNombre: string
  autor: string
  año: string
}

interface VectorizeMatch {
  id: string
  score: number
  metadata?: {
    documentoId?: string
    texto?: string
    pagina?: number
    documentoNombre?: string
    autor?: string
    año?: string
    [key: string]: unknown
  }
}

interface VectorizeResult {
  matches: VectorizeMatch[]
}

// Vectorize soporta máx 1536 dims; gemini-embedding-2 genera 3072.
// Los embeddings Gemini son matryoshka: truncar preserva la semántica.
const VECTORIZE_DIMS = 1536

const LOAD_BATCH = 30

export async function semanticSearch(
  query: string,
  accessToken: string,
  opciones?: { documentoIds?: string[]; topK?: number; maxFiles?: number }
): Promise<FragmentoConDocumento[]> {
  const { topK = 12, documentoIds, maxFiles } = opciones ?? {}

  // Generar embedding de la query
  const queryEmbedding = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
    return (await model.embedContent(query)).embedding.values
  })

  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  if (vectorizeUrl && workerSecret) {
    try {
      const results = await semanticSearchVectorize(queryEmbedding, accessToken, { topK, documentoIds, vectorizeUrl, workerSecret })
      // Si hay resultados con texto real, usarlos; si no (metadata ausente o vacía), usar Drive
      if (results.length > 0 && results.some((r) => r.texto.trim().length > 0)) return results
      console.warn('[search] Vectorize sin metadata útil — fallback a Drive')
    } catch (e) {
      console.warn('[search] Vectorize error — fallback a Drive:', e)
    }
  }

  return semanticSearchDrive(queryEmbedding, accessToken, { topK, documentoIds, maxFiles: maxFiles ?? 15 })
}

// ── Path Vectorize ────────────────────────────────────────────────────────────

async function semanticSearchVectorize(
  queryEmbedding: number[],
  accessToken: string,
  opts: { topK: number; documentoIds?: string[]; vectorizeUrl: string; workerSecret: string }
): Promise<FragmentoConDocumento[]> {
  const { topK, documentoIds, vectorizeUrl, workerSecret } = opts

  // Pedir más resultados de los que se van a devolver para poder diversificar por documento
  const MAX_PER_DOC = 4
  const requestTopK = documentoIds?.length ? topK * 4 : topK * 3

  const res = await fetch(`${vectorizeUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({ vector: queryEmbedding.slice(0, VECTORIZE_DIMS), topK: requestTopK }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vectorize query failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const result: VectorizeResult = await res.json()
  let matches = result.matches ?? []

  // Filtrar por documentoIds si aplica
  if (documentoIds?.length) {
    const allowed = new Set(documentoIds)
    matches = matches.filter((m) => m.metadata?.documentoId && allowed.has(m.metadata.documentoId as string))
  }

  // Diversificar: máximo MAX_PER_DOC fragmentos por documento, preservando orden de relevancia
  const countPerDoc = new Map<string, number>()
  matches = matches.filter((m) => {
    const docId = (m.metadata?.documentoId as string) ?? ''
    const count = countPerDoc.get(docId) ?? 0
    if (count >= MAX_PER_DOC) return false
    countPerDoc.set(docId, count + 1)
    return true
  }).slice(0, topK)

  if (matches.length === 0) return []

  return matches.map((m) => ({
    id: m.id,
    documentoId: (m.metadata?.documentoId as string) ?? '',
    texto: (m.metadata?.texto as string) ?? '',
    pagina: (m.metadata?.pagina as number) ?? 0,
    embedding: [],  // no se retorna desde Vectorize para ahorrar ancho de banda
    documentoNombre: (m.metadata?.documentoNombre as string) || 'Documento desconocido',
    autor: (m.metadata?.autor as string) ?? '',
    año: (m.metadata?.año as string) ?? '',
  }))
}

// ── Fallback Drive ────────────────────────────────────────────────────────────

async function semanticSearchDrive(
  queryEmbedding: number[],
  accessToken: string,
  opts: { topK: number; documentoIds?: string[]; maxFiles: number }
): Promise<FragmentoConDocumento[]> {
  const { topK, documentoIds, maxFiles } = opts

  const estructura = await initUserDrive(accessToken)
  const fragmentos: Fragmento[] = []

  if (documentoIds?.length) {
    const results = await Promise.allSettled(
      documentoIds.map(async (id) => {
        const fileId = await findFile(accessToken, `emb_${id}.json`, estructura.indexId)
        if (!fileId) return [] as Fragmento[]
        return readJSON<Fragmento[]>(accessToken, fileId)
      })
    )
    fragmentos.push(...results.flatMap((r) => r.status === 'fulfilled' ? r.value : []))
  } else {
    const todosArchivos = await listFilesInFolder(accessToken, estructura.indexId, 'emb_')
    const archivos = todosArchivos.slice(0, maxFiles)
    for (let i = 0; i < archivos.length; i += LOAD_BATCH) {
      const lote = archivos.slice(i, i + LOAD_BATCH)
      const results = await Promise.allSettled(
        lote.map((a) => readJSON<Fragmento[]>(accessToken, a.id))
      )
      fragmentos.push(...results.flatMap((r) => r.status === 'fulfilled' ? r.value : []))
    }
  }

  if (!fragmentos.length) return []

  const conSimilitud = fragmentos.map((f) => ({
    ...f,
    similitud: cosineSimilarity(queryEmbedding, f.embedding),
  }))
  conSimilitud.sort((a, b) => b.similitud - a.similitud)
  const top = conSimilitud.slice(0, topK)

  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const docMap = new Map<string, Documento>(documentos.map((d) => [d.id, d]))

  return top.map(({ similitud: _s, ...f }) => {
    const doc = docMap.get(f.documentoId)
    return {
      ...f,
      documentoNombre: doc?.nombre ?? 'Documento desconocido',
      autor: doc?.autor ?? '',
      año: doc?.año ?? '',
    }
  })
}
