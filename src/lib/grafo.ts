import { Documento, Fragmento, Grafo, NodoGrafo, AristaGrafo, FichaLectura } from '@/types'
import { initUserDrive, findFile, readJSON, listPDFs, writeJSON } from './drive'
import { cosineSimilarity } from './indexer'

export async function buildGrafo(accessToken: string): Promise<Grafo> {
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const indexados = documentos.filter((d) => d.estado === 'indexado')

  const nodos: NodoGrafo[] = []
  const aristas: AristaGrafo[] = []
  const autoresVistos = new Set<string>()

  // Nodes per document
  for (const doc of indexados) {
    nodos.push({
      id: doc.id,
      tipo: 'documento',
      label: doc.nombre.replace(/\.pdf$/i, '').slice(0, 40),
      peso: doc.fragmentos || 1,
    })

    // Author node
    if (doc.autor) {
      const apellido = doc.autor.split(',')[0].trim()
      const autorId = `autor_${apellido}`
      if (!autoresVistos.has(autorId)) {
        autoresVistos.add(autorId)
        nodos.push({ id: autorId, tipo: 'autor', label: apellido, peso: 1 })
      }
      aristas.push({
        source: doc.id,
        target: autorId,
        tipo: 'citacion',
        peso: 1,
      })
      // Increment author weight
      const autorNodo = nodos.find((n) => n.id === autorId)
      if (autorNodo) autorNodo.peso += 1
    }

    // Concept nodes from fichas
    try {
      const fichaFileId = await findFile(accessToken, `ficha_${doc.id}.json`, estructura.notasId)
      if (fichaFileId) {
        const ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)
        for (const ck of (ficha.conceptosClave ?? []).slice(0, 5)) {
          const conceptoId = `concepto_${ck.concepto.toLowerCase().replace(/\s+/g, '_')}`
          if (!nodos.find((n) => n.id === conceptoId)) {
            nodos.push({ id: conceptoId, tipo: 'concepto', label: ck.concepto, peso: 1 })
          } else {
            const cn = nodos.find((n) => n.id === conceptoId)!
            cn.peso += 1
          }
          aristas.push({
            source: doc.id,
            target: conceptoId,
            tipo: 'conceptual',
            label: ck.concepto,
            peso: 1,
          })
        }
      }
    } catch { /* ficha not available */ }
  }

  // Document-document edges via embedding similarity
  try {
    const embeddingsFileId = await findFile(accessToken, 'embeddings.json', estructura.indexId)
    if (embeddingsFileId && indexados.length > 1) {
      const fragmentos = await readJSON<Fragmento[]>(accessToken, embeddingsFileId)

      // Compute average embedding per document
      const avgEmbeddings = new Map<string, number[]>()
      for (const doc of indexados) {
        const docFrags = fragmentos.filter((f) => f.documentoId === doc.id)
        if (!docFrags.length) continue
        const dim = docFrags[0].embedding.length
        const avg = new Array(dim).fill(0)
        for (const f of docFrags) f.embedding.forEach((v, i) => { avg[i] += v })
        avgEmbeddings.set(doc.id, avg.map((v) => v / docFrags.length))
      }

      const docIds = Array.from(avgEmbeddings.keys())
      for (let i = 0; i < docIds.length; i++) {
        for (let j = i + 1; j < docIds.length; j++) {
          const sim = cosineSimilarity(avgEmbeddings.get(docIds[i])!, avgEmbeddings.get(docIds[j])!)
          if (sim > 0.6) {
            aristas.push({
              source: docIds[i],
              target: docIds[j],
              tipo: 'conceptual',
              peso: Math.round(sim * 10),
            })
          }
        }
      }
    }
  } catch { /* embeddings not available */ }

  const grafo: Grafo = { nodos, aristas, actualizadoEn: new Date().toISOString() }

  // Cache the graph
  await writeJSON(accessToken, estructura.conceptosId, 'grafo.json', grafo)

  return grafo
}
