import { Documento, Grafo, NodoGrafo, AristaGrafo, FichaLectura } from '@/types'
import { initUserDrive, readJSON, listPDFs, writeJSON, listFilesInFolder } from './drive'

export async function buildGrafo(accessToken: string): Promise<Grafo> {
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const indexados = documentos.filter((d) => d.estado === 'indexado')

  const nodos: NodoGrafo[] = []
  const aristas: AristaGrafo[] = []
  const autoresVistos = new Set<string>()

  // Una sola llamada para listar todas las fichas — Map para O(1) lookup
  const fichaFiles = await listFilesInFolder(accessToken, estructura.notasId, 'ficha_')
  const fichaMap = new Map<string, string>() // docId → fileId
  for (const f of fichaFiles) {
    const match = f.name.match(/^ficha_(.+)\.json$/)
    if (match) fichaMap.set(match[1], f.id)
  }

  for (const doc of indexados) {
    nodos.push({
      id: doc.id,
      tipo: 'documento',
      label: doc.nombre.replace(/\.pdf$/i, '').slice(0, 40),
      peso: doc.fragmentos || 1,
      carpetaId: doc.carpetaId,
    })

    // Nodo autor + arista autor→doc
    if (doc.autor) {
      const apellido = doc.autor.split(',')[0].trim()
      const autorId = `autor_${apellido}`
      if (!autoresVistos.has(autorId)) {
        autoresVistos.add(autorId)
        nodos.push({ id: autorId, tipo: 'autor', label: apellido, peso: 1 })
      }
      aristas.push({ source: doc.id, target: autorId, tipo: 'citacion', peso: 1 })
      const autorNodo = nodos.find((n) => n.id === autorId)
      if (autorNodo) autorNodo.peso += 1
    }

    // Aristas doc→concepto desde ficha (si existe)
    const fichaFileId = fichaMap.get(doc.id)
    if (fichaFileId) {
      try {
        const ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)
        for (const ck of (ficha.conceptosClave ?? []).slice(0, 5)) {
          const conceptoId = `concepto_${ck.concepto.toLowerCase().replace(/\s+/g, '_')}`
          const existing = nodos.find((n) => n.id === conceptoId)
          if (!existing) {
            nodos.push({ id: conceptoId, tipo: 'concepto', label: ck.concepto, peso: 1 })
          } else {
            existing.peso += 1
          }
          aristas.push({
            source: doc.id,
            target: conceptoId,
            tipo: 'conceptual',
            label: ck.concepto,
            peso: 1,
          })
        }
      } catch { /* ficha ilegible — ignorar */ }
    }
  }

  // Aristas doc→doc compartiendo autor (O(n) por autor, no O(n²) global)
  const docsPorAutor = new Map<string, string[]>()
  for (const doc of indexados) {
    if (!doc.autor) continue
    const apellido = doc.autor.split(',')[0].trim()
    const list = docsPorAutor.get(apellido) ?? []
    list.push(doc.id)
    docsPorAutor.set(apellido, list)
  }
  for (const [, ids] of docsPorAutor) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        aristas.push({ source: ids[i], target: ids[j], tipo: 'citacion', peso: 2 })
      }
    }
  }

  const grafo: Grafo = { nodos, aristas, actualizadoEn: new Date().toISOString() }

  if (nodos.length > 0) {
    await writeJSON(accessToken, estructura.conceptosId, 'grafo.json', grafo)
  }

  return grafo
}
