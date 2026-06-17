import { Grafo, NodoGrafo, AristaGrafo, FichaLectura } from '@/types'
import { initUserDrive, readJSON, listPDFs, writeJSON, listFilesInFolder } from './drive'

const FICHA_CONCURRENCY = 20  // Drive API calls en paralelo

export async function buildGrafo(accessToken: string): Promise<Grafo> {
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const indexados = documentos.filter((d) => d.estado === 'indexado')

  // Una sola llamada para listar todas las fichas — Map para O(1) lookup
  const fichaFiles = await listFilesInFolder(accessToken, estructura.notasId, 'ficha_')
  const fichaMap = new Map<string, string>() // docId → fileId
  for (const f of fichaFiles) {
    const match = f.name.match(/^ficha_(.+)\.json$/)
    if (match) fichaMap.set(match[1], f.id)
  }

  // Leer fichas en paralelo (lotes de FICHA_CONCURRENCY para no saturar Drive)
  const docsConFicha = indexados.filter((d) => fichaMap.has(d.id))
  const fichaData = new Map<string, FichaLectura>()
  for (let i = 0; i < docsConFicha.length; i += FICHA_CONCURRENCY) {
    const lote = docsConFicha.slice(i, i + FICHA_CONCURRENCY)
    const results = await Promise.allSettled(
      lote.map((d) => readJSON<FichaLectura>(accessToken, fichaMap.get(d.id)!))
    )
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') fichaData.set(lote[j].id, r.value)
    })
  }

  const nodos: NodoGrafo[] = []
  const aristas: AristaGrafo[] = []
  const autoresMap = new Map<string, NodoGrafo>()  // autorId → nodo (O(1) lookup)
  const conceptosMap = new Map<string, NodoGrafo>() // conceptoId → nodo (O(1) lookup)

  for (const doc of indexados) {
    nodos.push({
      id: doc.id,
      tipo: 'documento',
      label: doc.nombre.replace(/\.pdf$/i, '').slice(0, 40),
      peso: doc.fragmentos || 1,
      carpetaId: doc.carpetaId,
    })

    // Nodo autor + arista doc→autor
    if (doc.autor) {
      const apellido = doc.autor.split(',')[0].trim()
      const autorId = `autor_${apellido}`
      let autorNodo = autoresMap.get(autorId)
      if (!autorNodo) {
        autorNodo = { id: autorId, tipo: 'autor', label: apellido, peso: 1 }
        nodos.push(autorNodo)
        autoresMap.set(autorId, autorNodo)
      }
      autorNodo.peso += 1
      aristas.push({ source: doc.id, target: autorId, tipo: 'citacion', peso: 1 })
    }

    // Aristas doc→concepto desde ficha
    const ficha = fichaData.get(doc.id)
    if (ficha) {
      for (const ck of (ficha.conceptosClave ?? []).slice(0, 5)) {
        const conceptoId = `concepto_${ck.concepto.toLowerCase().replace(/\s+/g, '_')}`
        let conceptoNodo = conceptosMap.get(conceptoId)
        if (!conceptoNodo) {
          conceptoNodo = { id: conceptoId, tipo: 'concepto', label: ck.concepto, peso: 1 }
          nodos.push(conceptoNodo)
          conceptosMap.set(conceptoId, conceptoNodo)
        } else {
          conceptoNodo.peso += 1
        }
        aristas.push({ source: doc.id, target: conceptoId, tipo: 'conceptual', label: ck.concepto, peso: 1 })
      }
    }
  }

  // Aristas doc↔doc compartiendo autor (O(n) por autor)
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
