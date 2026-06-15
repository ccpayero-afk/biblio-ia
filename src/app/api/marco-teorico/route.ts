import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, listPDFs, writeJSON } from '@/lib/drive'
import { semanticSearch } from '@/lib/search'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { problema, documentoIds, force } = await req.json() as {
      problema: string
      documentoIds?: string[]
      force?: boolean
    }

    if (!problema?.trim()) {
      return NextResponse.json({ error: 'El campo problema es requerido' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)

    let docIdsToUse: string[]

    if (documentoIds && documentoIds.length > 0) {
      docIdsToUse = documentoIds
    } else {
      // Búsqueda semántica — colapsar por doc, mejor score, top 6
      const fragmentos = await semanticSearch(problema.trim(), accessToken, { topK: 12 })
      const mejorScore = new Map<string, number>()
      for (const f of fragmentos) {
        // semanticSearch ya los devuelve ordenados por similitud, usamos el primero (mayor)
        if (!mejorScore.has(f.documentoId)) {
          mejorScore.set(f.documentoId, 1)
        }
      }
      docIdsToUse = [...mejorScore.keys()].slice(0, 6)
    }

    const cacheKey = hashStr(problema.trim().toLowerCase() + docIdsToUse.slice().sort().join(','))
    const cacheFile = `cache_marco_${cacheKey}.json`

    if (!force) {
      const cachedId = await findFile(accessToken, cacheFile, estructura.notasId)
      if (cachedId) {
        const cached = await readJSON(accessToken, cachedId)
        return NextResponse.json({ ...cached, fromCache: true })
      }
    }

    // Cargar fichas en paralelo
    const fichasRaw = await Promise.all(
      docIdsToUse.map(async (docId) => {
        try {
          const fileId = await findFile(accessToken, `ficha_${docId}.json`, estructura.notasId)
          if (!fileId) return null
          const ficha = await readJSON<FichaLectura>(accessToken, fileId)
          return { docId, ficha }
        } catch {
          return null
        }
      })
    )
    const fichasValidas = fichasRaw.filter(Boolean) as { docId: string; ficha: FichaLectura }[]

    if (fichasValidas.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron fichas de lectura para los documentos seleccionados.' },
        { status: 400 }
      )
    }

    // Metadatos de documentos
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    const docMap = new Map(documentos.map(d => [d.id, d]))

    const fichasTexto = fichasValidas.map(({ docId, ficha }) => {
      const doc = docMap.get(docId)
      const nombre = doc?.nombre ?? docId
      const autor = doc?.autor ?? 'Autor desconocido'
      const partes: string[] = [`[${autor} — ${nombre}]`]
      if (ficha.tesisCentral) partes.push(`Tesis: ${ficha.tesisCentral}`)
      if (ficha.posicionDebate) partes.push(`Posición: ${ficha.posicionDebate}`)
      if (ficha.conceptosClave?.length) {
        partes.push(`Conceptos: ${ficha.conceptosClave.map(c => `${c.concepto}: ${c.definicion}`).join('; ')}`)
      }
      return partes.join('\n')
    }).join('\n\n---\n\n')

    const prompt = `Sos un asistente académico especializado en construcción de marcos teóricos.

PROBLEMA DE INVESTIGACIÓN: "${problema}"

DOCUMENTOS DE REFERENCIA:
${fichasTexto}

Construí un marco teórico sólido para abordar este problema de investigación.
Respondé ÚNICAMENTE con JSON puro, sin bloques de código, sin explicaciones adicionales:

{
  "titulo": "Marco teórico: ${problema}",
  "conceptosFundamentales": [
    {
      "concepto": "nombre del concepto",
      "definicion": "definición académica clara",
      "autores": ["autor1", "autor2"],
      "relacion": "cómo se relaciona con el problema de investigación"
    }
  ],
  "corrientesTeoricas": [
    {
      "nombre": "nombre de la corriente",
      "representantes": ["autor1", "autor2"],
      "planteamiento": "planteamiento central de esta corriente"
    }
  ],
  "tensiones": ["tensión teórica 1", "tensión teórica 2"],
  "propuestaEstructura": ["1. Introducción al debate", "2. ...", "3. ...", "4. Síntesis"],
  "sugerenciaInvestigador": "recomendación práctica y concreta para este investigador sobre cómo posicionarse teóricamente"
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

    const marcoTeorico = JSON.parse(cleaned)

    const documentosUsados = fichasValidas.map(({ docId }) => {
      const doc = docMap.get(docId)
      return {
        id: docId,
        nombre: doc?.nombre ?? docId,
        autor: doc?.autor ?? 'Autor desconocido',
      }
    })

    const respuesta = { marcoTeorico, documentosUsados, generadoEn: new Date().toISOString() }
    await writeJSON(accessToken, estructura.notasId, cacheFile, respuesta)
    return NextResponse.json(respuesta)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
