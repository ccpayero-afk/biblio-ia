import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, findFile, listPDFs } from '@/lib/drive'
import { leerIndice, NotaLigera } from '@/lib/notas'
import { semanticSearch } from '@/lib/search'
import type { Cita } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { tema, carpetasIds } = (await req.json()) as { tema: string; carpetasIds?: string[] }

    if (!tema?.trim()) return NextResponse.json({ error: 'Se requiere un tema' }, { status: 400 })

    const estructura = await initUserDrive(accessToken)

    // Semantic search
    let fragmentos: Awaited<ReturnType<typeof semanticSearch>> = []
    try { fragmentos = await semanticSearch(tema, accessToken, { topK: 40 }) } catch { /* sin índice */ }

    // Collapse to top 8 docs
    const seen = new Set<string>()
    const matchedDocIds: string[] = []
    for (const f of fragmentos) {
      if (!seen.has(f.documentoId)) { seen.add(f.documentoId); matchedDocIds.push(f.documentoId) }
      if (matchedDocIds.length >= 8) break
    }

    // Filter by carpeta
    let filteredDocIds = matchedDocIds
    if (carpetasIds?.length) {
      const allDocs = await listPDFs(accessToken, estructura.pdfsId)
      const docMap = new Map(allDocs.map(d => [d.id, d]))
      filteredDocIds = matchedDocIds.filter(id => {
        const d = docMap.get(id); return d?.carpetaId && carpetasIds.includes(d.carpetaId)
      })
    }

    // Count citas
    let citasCount = 0
    try {
      const citasFileId = await findFile(accessToken, 'citas.json', estructura.notasId)
      if (citasFileId) {
        const citas = await readJSON<Cita[]>(accessToken, citasFileId) ?? []
        citasCount = citas.filter(c => filteredDocIds.includes(c.documentoId)).length
      }
    } catch { /* sin citas */ }

    // Count notas (lean index is sufficient for counting)
    let notasCount = 0
    try {
      const { indice } = await leerIndice(accessToken)
      const temaWords = tema.split(/\s+/).filter(w => w.length > 4)
      const docIdSet = new Set(filteredDocIds)
      type EntryExt = NotaLigera & { eliminadaEn?: string; documentoOrigenId?: string; documentoId?: string; contenido?: string }
      notasCount = (indice as EntryExt[]).filter(n => {
        if (n.eliminadaEn) return false
        if (n.documentoOrigenId && docIdSet.has(n.documentoOrigenId)) return true
        if (n.documentoId && docIdSet.has(n.documentoId)) return true
        if (temaWords.length) {
          const txt = `${n.titulo ?? ''} ${n.contenido ?? ''}`.toLowerCase()
          return temaWords.some(w => txt.includes(w.toLowerCase()))
        }
        return false
      }).length
    } catch { /* sin notas */ }

    return NextResponse.json({ docsCount: filteredDocIds.length, citasCount, notasCount, docIds: filteredDocIds })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
