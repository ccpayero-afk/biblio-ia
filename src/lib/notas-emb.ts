import { initUserDrive, findFile, readJSON, writeJSON } from './drive'
import { generateWithRotation, GEMINI_MODEL_EMBEDDING } from './gemini'
import { cosineSimilarity } from './indexer'

// Matryoshka truncation: 256 dims balances quality vs file size
// 5000 notes × 256 floats × ~8 bytes JSON = ~10MB ceiling
export const NOTA_EMB_DIMS = 256
const EMB_FILE = 'notas_emb.json'

export async function leerEmbeddingsNotas(accessToken: string): Promise<Record<string, number[]>> {
  const { notasId } = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, EMB_FILE, notasId)
  if (!fileId) return {}
  return readJSON<Record<string, number[]>>(accessToken, fileId).catch(() => ({}))
}

export async function generarEmbeddingTexto(texto: string, accessToken: string): Promise<number[]> {
  const values = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_EMBEDDING })
    return (await model.embedContent(texto.slice(0, 2000))).embedding.values
  })
  return values.slice(0, NOTA_EMB_DIMS)
}

// Read-modify-write. Race condition is negligible for a per-user Drive file.
export async function guardarEmbeddingNota(
  accessToken: string,
  notaId: string,
  titulo: string,
  contenido: string
): Promise<void> {
  const texto = `${titulo} ${contenido}`
  const embedding = await generarEmbeddingTexto(texto, accessToken)
  const { notasId } = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, EMB_FILE, notasId)
  const existing: Record<string, number[]> = fileId
    ? await readJSON<Record<string, number[]>>(accessToken, fileId).catch(() => ({} as Record<string, number[]>))
    : {}
  existing[notaId] = embedding
  await writeJSON(accessToken, notasId, EMB_FILE, existing)
}

export async function eliminarEmbeddingNota(accessToken: string, notaId: string): Promise<void> {
  const { notasId } = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, EMB_FILE, notasId)
  if (!fileId) return
  const existing: Record<string, number[]> = await readJSON<Record<string, number[]>>(accessToken, fileId).catch(() => ({} as Record<string, number[]>))
  if (!(notaId in existing)) return
  delete existing[notaId]
  await writeJSON(accessToken, notasId, EMB_FILE, existing)
}

// Returns candidates sorted by cosine similarity (descending)
export function ranquearNotasPorSimilitud(
  queryEmbedding: number[],
  candidatosIds: string[],
  embeddings: Record<string, number[]>
): { id: string; similitud: number }[] {
  return candidatosIds
    .filter((id) => embeddings[id])
    .map((id) => ({ id, similitud: cosineSimilarity(queryEmbedding, embeddings[id]) }))
    .sort((a, b) => b.similitud - a.similitud)
}

// Greedy MMR: pick n notes that maximize semantic diversity among themselves
export function seleccionarNotasDiversasMMR(
  candidatosIds: string[],
  embeddings: Record<string, number[]>,
  n: number
): string[] {
  const conEmb = candidatosIds.filter((id) => embeddings[id])
  if (conEmb.length === 0) return candidatosIds.slice(0, n)

  const selected: string[] = [conEmb[0]]
  const pool = conEmb.slice(1)

  while (selected.length < Math.min(n, conEmb.length) && pool.length > 0) {
    let bestIdx = 0
    let lowestMaxSim = Infinity

    for (let i = 0; i < pool.length; i++) {
      const emb = embeddings[pool[i]]
      const maxSim = Math.max(
        ...selected.map((s) => cosineSimilarity(embeddings[s], emb))
      )
      if (maxSim < lowestMaxSim) {
        lowestMaxSim = maxSim
        bestIdx = i
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0])
  }

  // Fill remaining quota with notes that have no embedding
  const sinEmb = candidatosIds.filter((id) => !embeddings[id])
  return [...selected, ...sinEmb].slice(0, n)
}
