import { Fragmento, Documento } from '@/types'
import { initUserDrive, findFile, readJSON, listPDFs, listFilesInFolder } from './drive'
import { generateWithRotation, GEMINI_MODEL_EMBEDDING, GEMINI_MODEL_PIPELINE } from './gemini'
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

// Corrige doble-encoding UTF-8/Latin-1 en metadatos de Vectorize
// "Ã±" → "ñ", "Ã©" → "é", etc.
function fixEncoding(str: string): string {
  if (!str) return str
  try {
    return decodeURIComponent(escape(str))
  } catch {
    return str
  }
}

// Descarta fragmentos con texto OCR ilegible (< 60 chars o < 50% letras reales)
function isValidFragment(text: string): boolean {
  if (!text || text.trim().length < 60) return false
  const letters = (text.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g) ?? []).length
  return letters / text.length >= 0.45
}

// Vectorize soporta máx 1536 dims; gemini-embedding-2 genera 3072.
// Los embeddings Gemini son matryoshka: truncar preserva la semántica.
const VECTORIZE_DIMS = 1536
// Vectorize acepta máx 100 resultados por query
const VECTORIZE_MAX_TOPK = 100

const LOAD_BATCH = 30
const MAX_PER_DOC = 6

export async function semanticSearch(
  query: string,
  accessToken: string,
  opciones?: { documentoIds?: string[]; topK?: number; maxFiles?: number; añoDesde?: string; añoHasta?: string }
): Promise<FragmentoConDocumento[]> {
  const { topK = 60, documentoIds, maxFiles, añoDesde, añoHasta } = opciones ?? {}

  const vectorizeUrl = process.env.VECTORIZE_WORKER_URL
  const workerSecret = process.env.WORKER_SECRET

  if (vectorizeUrl && workerSecret) {
    try {
      const results = await semanticSearchMultiQuery(query, accessToken, { topK, documentoIds, vectorizeUrl, workerSecret, añoDesde, añoHasta })
      if (results.length > 0 && results.some((r) => r.texto.trim().length > 0)) return results
      console.warn('[search] Vectorize sin metadata útil — fallback a Drive')
    } catch (e) {
      console.warn('[search] Vectorize error — fallback a Drive:', e)
    }
  }

  // Fallback: búsqueda directa en Drive con el embedding original
  const queryEmbedding = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
    return (await model.embedContent(query)).embedding.values
  })
  return semanticSearchDrive(queryEmbedding, accessToken, { topK, documentoIds, maxFiles: maxFiles ?? 15 })
}

// ── Query expansion: genera variantes semánticas para ampliar cobertura ────────

async function generateAlternativeQueries(query: string, accessToken: string): Promise<string[]> {
  try {
    const text = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_PIPELINE,
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object,
      })
      const res = await model.generateContent(
        `Dado este tema de investigación académica: "${query}"\n` +
        `Generá 3 frases de búsqueda alternativas en español, orientadas a conceptos clave, que complementen la búsqueda original.\n` +
        `Respondé SOLO con las 3 frases, una por línea, sin numeración ni explicaciones.`
      )
      return res.response.text()
    })
    const alternatives = text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3)
    return alternatives.length > 0 ? [query, ...alternatives] : [query]
  } catch {
    return [query]
  }
}

// ── Multi-query search con Vectorize ─────────────────────────────────────────

async function semanticSearchMultiQuery(
  query: string,
  accessToken: string,
  opts: { topK: number; documentoIds?: string[]; vectorizeUrl: string; workerSecret: string; añoDesde?: string; añoHasta?: string }
): Promise<FragmentoConDocumento[]> {
  const { topK, documentoIds, vectorizeUrl, workerSecret, añoDesde, añoHasta } = opts

  // Generar queries alternativas y embeddings en paralelo
  const [queries] = await Promise.all([generateAlternativeQueries(query, accessToken)])

  const embeddings = await Promise.all(
    queries.map((q) =>
      generateWithRotation(accessToken, async (genAI) => {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
        return (await model.embedContent(q)).embedding.values
      })
    )
  )

  // Búsquedas paralelas en Vectorize (máx VECTORIZE_MAX_TOPK por query)
  const perQueryTopK = Math.min(VECTORIZE_MAX_TOPK, Math.ceil(topK * 1.5))
  const allMatchArrays = await Promise.allSettled(
    embeddings.map((emb) => queryVectorize(emb, perQueryTopK, vectorizeUrl, workerSecret))
  )

  // Fusionar y deduplicar por ID conservando el score más alto
  const bestByid = new Map<string, VectorizeMatch>()
  for (const res of allMatchArrays) {
    if (res.status !== 'fulfilled') continue
    for (const m of res.value) {
      const existing = bestByid.get(m.id)
      if (!existing || m.score > existing.score) bestByid.set(m.id, m)
    }
  }

  // Ordenar por score descendente
  let merged = [...bestByid.values()].sort((a, b) => b.score - a.score)

  // Filtrar por documentoIds si aplica
  if (documentoIds?.length) {
    const allowed = new Set(documentoIds)
    merged = merged.filter((m) => m.metadata?.documentoId && allowed.has(m.metadata.documentoId as string))
  }

  // Diversificar: máx MAX_PER_DOC por documento, tomar topK finales
  const countPerDoc = new Map<string, number>()
  let diversified = merged.filter((m) => {
    const docId = (m.metadata?.documentoId as string) ?? ''
    const count = countPerDoc.get(docId) ?? 0
    if (count >= MAX_PER_DOC) return false
    countPerDoc.set(docId, count + 1)
    return true
  }).slice(0, topK)

  // Filtrar por rango de año si se especifica
  if (añoDesde || añoHasta) {
    const desde = añoDesde ?? ''
    const hasta = añoHasta ?? '9999'
    const filtered = diversified.filter((m) => {
      const año = ((m.metadata?.año as string) ?? '').trim()
      if (!año || !/^\d{4}$/.test(año)) return true
      return año >= desde && año <= hasta
    })
    if (filtered.length > 0) diversified = filtered
  }

  if (diversified.length === 0) return []

  return diversified
    .map((m) => ({
      id: m.id,
      documentoId: (m.metadata?.documentoId as string) ?? '',
      texto: fixEncoding((m.metadata?.texto as string) ?? ''),
      pagina: (m.metadata?.pagina as number) ?? 0,
      embedding: [],
      documentoNombre: fixEncoding((m.metadata?.documentoNombre as string) || 'Documento desconocido'),
      autor: fixEncoding((m.metadata?.autor as string) ?? ''),
      año: fixEncoding((m.metadata?.año as string) ?? ''),
    }))
    .filter((f) => isValidFragment(f.texto))
}

async function queryVectorize(
  embedding: number[],
  topK: number,
  vectorizeUrl: string,
  workerSecret: string
): Promise<VectorizeMatch[]> {
  const res = await fetch(`${vectorizeUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ vector: embedding.slice(0, VECTORIZE_DIMS), topK }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vectorize query failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const result: VectorizeResult = await res.json()
  return result.matches ?? []
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
