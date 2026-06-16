import { Fragmento, Documento } from '@/types'
import { initUserDrive, findFile, readJSON, listPDFs, listFilesInFolder } from './drive'
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
    [key: string]: unknown
  }
}

interface VectorizeResult {
  matches: VectorizeMatch[]
}

const LOAD_BATCH = 30

export async function semanticSearch(
  query: string,
  accessToken: string,
  opciones?: { documentoIds?: string[]; topK?: number; maxFiles?: number }
): Promise<FragmentoConDocumento[]> {
  const { topK = 8, documentoIds, maxFiles } = opciones ?? {}

  // Generar embedding de la query
  const queryEmbedding = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
    return (await model.embedContent(query)).embedding.values
  })

  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  if (vectorizeUrl && workerSecret) {
    return semanticSearchVectorize(queryEmbedding, accessToken, { topK, documentoIds, vectorizeUrl, workerSecret })
  }

  console.warn('[search] VECTORIZE_WORKER_URL no configurado — usando fallback de Drive')
  return semanticSearchDrive(queryEmbedding, accessToken, { topK, documentoIds, maxFiles: maxFiles ?? 15 })
}

// ── Path Vectorize ────────────────────────────────────────────────────────────

async function semanticSearchVectorize(
  queryEmbedding: number[],
  accessToken: string,
  opts: { topK: number; documentoIds?: string[]; vectorizeUrl: string; workerSecret: string }
): Promise<FragmentoConDocumento[]> {
  const { topK, documentoIds, vectorizeUrl, workerSecret } = opts

  // Solicitar más resultados cuando hay filtro por docs para compensar la reducción
  const requestTopK = documentoIds?.length ? topK * 3 : topK

  const res = await fetch(`${vectorizeUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({ vector: queryEmbedding, topK: requestTopK }),
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

  matches = matches.slice(0, topK)

  if (matches.length === 0) return []

  // Enriquecer con metadatos del documento
  const documentos = await listPDFs(accessToken, (await initUserDrive(accessToken)).pdfsId)
  const docMap = new Map<string, Documento>(documentos.map((d) => [d.id, d]))

  return matches.map((m) => {
    const documentoId = (m.metadata?.documentoId as string) ?? ''
    const doc = docMap.get(documentoId)
    return {
      id: m.id,
      documentoId,
      texto: (m.metadata?.texto as string) ?? '',
      pagina: (m.metadata?.pagina as number) ?? 0,
      embedding: [],  // no se retorna desde Vectorize para ahorrar ancho de banda
      documentoNombre: doc?.nombre ?? 'Documento desconocido',
      autor: doc?.autor ?? '',
      año: doc?.año ?? '',
    }
  })
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
