import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, listPDFs, writeJSON } from '@/lib/drive'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { docIds, force } = await req.json() as { docIds: [string, string]; force?: boolean }

    if (!Array.isArray(docIds) || docIds.length !== 2) {
      return NextResponse.json({ error: 'Se requieren exactamente 2 IDs de documentos' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)

    const sortedIds = [...docIds].sort()
    const cacheFile = `cache_comp_${sortedIds[0]}_${sortedIds[1]}.json`

    if (!force) {
      const cachedId = await findFile(accessToken, cacheFile, estructura.notasId)
      if (cachedId) {
        const cached = await readJSON(accessToken, cachedId)
        return NextResponse.json({ ...cached, fromCache: true })
      }
    }

    // Cargar todos los documentos para obtener metadatos
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    const docMap = new Map(documentos.map(d => [d.id, d]))

    // Cargar ambas fichas en paralelo
    const [ficha1, ficha2] = await Promise.all(
      docIds.map(async (docId) => {
        const fileId = await findFile(accessToken, `ficha_${docId}.json`, estructura.notasId)
        if (!fileId) return null
        return await readJSON<FichaLectura>(accessToken, fileId)
      })
    )

    if (!ficha1 || !ficha2) {
      const missing = docIds[!ficha1 ? 0 : 1]
      return NextResponse.json(
        { error: `No se encontró la ficha del documento ${missing}. Generá la ficha antes de comparar.` },
        { status: 400 }
      )
    }

    const doc1 = docMap.get(docIds[0])
    const doc2 = docMap.get(docIds[1])

    function fichaToText(f: FichaLectura): string {
      const partes: string[] = []
      if (f.tesisCentral) partes.push(`Tesis central: ${f.tesisCentral}`)
      if (f.argumentoPrincipal) partes.push(`Argumento principal: ${f.argumentoPrincipal}`)
      if (f.metodologia) partes.push(`Metodología: ${f.metodologia}`)
      if (f.posicionDebate) partes.push(`Posición en el debate: ${f.posicionDebate}`)
      if (f.conceptosClave?.length) {
        partes.push(`Conceptos clave: ${f.conceptosClave.map(c => c.concepto).join(', ')}`)
      }
      if (f.limitaciones) partes.push(`Limitaciones: ${f.limitaciones}`)
      if (f.relevancia) partes.push(`Relevancia: ${f.relevancia}`)
      return partes.join('\n')
    }

    const nombre1 = doc1?.nombre ?? docIds[0]
    const nombre2 = doc2?.nombre ?? docIds[1]
    const autor1 = doc1?.autor ?? 'Autor desconocido'
    const autor2 = doc2?.autor ?? 'Autor desconocido'

    const prompt = `Sos un asistente académico especializado en análisis comparativo de textos.

DOCUMENTO 1: "${nombre1}" — ${autor1}
${fichaToText(ficha1)}

DOCUMENTO 2: "${nombre2}" — ${autor2}
${fichaToText(ficha2)}

Compará ambos documentos de forma detallada y académica.
Respondé ÚNICAMENTE con JSON puro, sin bloques de código, sin explicaciones adicionales:

{
  "titulo": "Comparación: ${autor1} vs ${autor2}",
  "filas": [
    {"aspecto": "Tesis central", "doc1": "...", "doc2": "..."},
    {"aspecto": "Metodología", "doc1": "...", "doc2": "..."},
    {"aspecto": "Marco teórico", "doc1": "...", "doc2": "..."},
    {"aspecto": "Posición en el debate", "doc1": "...", "doc2": "..."},
    {"aspecto": "Conceptos clave", "doc1": "...", "doc2": "..."},
    {"aspecto": "Limitaciones", "doc1": "...", "doc2": "..."},
    {"aspecto": "Aporte complementario", "doc1": "...", "doc2": "..."}
  ],
  "conclusion": "síntesis comparativa en 2-3 oraciones destacando convergencias y divergencias principales"
}`

    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent(prompt)
    })
    const text = result.response.text()

    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    const comparacion = JSON.parse(cleaned)

    const respuesta = {
      comparacion,
      doc1: { nombre: nombre1, autor: autor1 },
      doc2: { nombre: nombre2, autor: autor2 },
      generadoEn: new Date().toISOString(),
    }
    await writeJSON(accessToken, estructura.notasId, cacheFile, respuesta)
    return NextResponse.json(respuesta)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
