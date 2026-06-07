import { Fragmento, Documento } from '@/types'
import { initUserDrive, findFile, readJSON, listPDFs } from './drive'
import { getGeminiClient } from './gemini'
import { GEMINI_MODEL_EMBEDDING } from './gemini'
import { cosineSimilarity } from './indexer'

export interface FragmentoConDocumento extends Fragmento {
  documentoNombre: string
  autor: string
  año: string
}

export async function semanticSearch(
  query: string,
  accessToken: string,
  opciones?: { documentoIds?: string[]; topK?: number }
): Promise<FragmentoConDocumento[]> {
  const { topK = 8, documentoIds } = opciones ?? {}

  // Cargar índice de embeddings desde Drive
  const estructura = await initUserDrive(accessToken)
  const embeddingsFileId = await findFile(accessToken, 'embeddings.json', estructura.indexId)
  if (!embeddingsFileId) return []

  let fragmentos: Fragmento[] = await readJSON<Fragmento[]>(accessToken, embeddingsFileId)
  if (!fragmentos.length) return []

  // Filtrar por documentos si se especificó
  if (documentoIds?.length) {
    fragmentos = fragmentos.filter((f) => documentoIds.includes(f.documentoId))
  }

  // Embeber la query
  const genAI = await getGeminiClient(accessToken)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
  const queryEmbedding = (await model.embedContent(query)).embedding.values

  // Calcular similitudes y ordenar
  const conSimilitud = fragmentos.map((f) => ({
    ...f,
    similitud: cosineSimilarity(queryEmbedding, f.embedding),
  }))
  conSimilitud.sort((a, b) => b.similitud - a.similitud)
  const top = conSimilitud.slice(0, topK)

  // Enriquecer con metadatos del documento
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
