export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, listFilesInFolder, findFile, readJSON } from '@/lib/drive'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { Cita, Documento, FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const FICHA_CONCURRENCY = 20
const MAX_DOCS_GEMINI = 150  // cap para no saturar el contexto del modelo

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const carpetasIds = req.nextUrl.searchParams.getAll('carpetasIds')

    const todosDocumentos = await listPDFs(accessToken, estructura.pdfsId)

    // Filtrar por scope si se especificaron carpetas
    const documentos: Documento[] = carpetasIds.length
      ? todosDocumentos.filter((d) => carpetasIds.includes(d.carpetaId ?? '__sin_carpeta__'))
      : todosDocumentos

    const indexados = documentos.filter((d) => d.estado === 'indexado')

    // Un solo listFilesInFolder para todas las fichas — Map para O(1) lookup
    const fichaFiles = await listFilesInFolder(accessToken, estructura.notasId, 'ficha_')
    const fichaMap = new Map<string, string>()
    for (const f of fichaFiles) {
      const match = f.name.match(/^ficha_(.+)\.json$/)
      if (match) fichaMap.set(match[1], f.id)
    }

    // Leer fichas en paralelo (solo las de docs en scope)
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

    // Frecuencia de autores
    const autorFrecuencia = new Map<string, number>()
    for (const doc of documentos) {
      if (!doc.autor) continue
      const apellido = doc.autor.split(',')[0].trim()
      autorFrecuencia.set(apellido, (autorFrecuencia.get(apellido) ?? 0) + 1)
    }
    const autoresMasCitados = [...autorFrecuencia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))

    // Frecuencia de conceptos (desde fichas ya cargadas en memoria)
    const conceptoFrecuencia = new Map<string, number>()
    for (const ficha of fichaData.values()) {
      for (const ck of ficha.conceptosClave ?? []) {
        const c = ck.concepto.toLowerCase()
        conceptoFrecuencia.set(c, (conceptoFrecuencia.get(c) ?? 0) + 1)
      }
    }
    const conceptosMasFrecuentes = [...conceptoFrecuencia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concepto, frecuencia]) => ({ concepto, frecuencia }))

    // Stats
    const stats = {
      totalDocumentos: documentos.length,
      documentosIndexados: indexados.length,
      fichasGeneradas: fichaData.size,
      totalFragmentos: indexados.reduce((s, d) => s + d.fragmentos, 0),
      totalCitas: 0,
    }

    // Citas (solo si es toda la biblioteca o no hay filtro de carpeta)
    if (!carpetasIds.length) {
      const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
      if (citasFileId) {
        try {
          const citas = await readJSON<Cita[]>(accessToken, citasFileId)
          stats.totalCitas = citas.length
        } catch { /* empty */ }
      }
    }

    // Pregunta diaria + brechas con Gemini
    let preguntaDiaria = ''
    let brechasDetectadas: string[] = []
    if (indexados.length >= 2) {
      try {
        const muestra = documentos.slice(0, MAX_DOCS_GEMINI)
        const listaTextos = muestra
          .map((d) => `- "${d.nombre.replace(/\.pdf$/i, '')}" (${d.autor || '?'}, ${d.año || 's.f.'})`)
          .join('\n')

        const contextoScope = carpetasIds.length
          ? `Esta es una selección filtrada por carpeta (${documentos.length} documentos).`
          : `Esta es la biblioteca completa (${documentos.length} documentos${documentos.length > MAX_DOCS_GEMINI ? `, mostrando muestra de ${MAX_DOCS_GEMINI}` : ''}).`

        const result = await generateWithRotation(accessToken, async (genAI) => {
          const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
          return model.generateContent(
            `Analizá esta biblioteca académica de ciencias sociales latinoamericanas. ${contextoScope}\n\n${listaTextos}\n\n` +
            `Respondé con JSON puro (sin markdown ni bloques de código):\n` +
            `{"preguntaDiaria":"Una pregunta investigativa profunda y específica que esta colección podría responder","brechas":["brecha1","brecha2","brecha3"]}\n` +
            `Las brechas son temas relevantes para la temática pero ausentes o subrepresentados en esta colección.`
          )
        })

        let txt = result.response.text().trim()
        if (txt.includes('```')) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
        const parsed = JSON.parse(txt)
        preguntaDiaria = parsed.preguntaDiaria ?? ''
        brechasDetectadas = parsed.brechas ?? []
      } catch { /* AI unavailable */ }
    }

    return NextResponse.json({
      stats,
      autoresMasCitados,
      conceptosMasFrecuentes,
      preguntaDiaria,
      brechasDetectadas,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
