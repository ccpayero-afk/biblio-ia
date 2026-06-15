import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
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

    const { tema, force } = await req.json() as { tema: string; carpetasIds?: string[]; force?: boolean }

    if (!tema?.trim()) {
      return NextResponse.json({ error: 'El campo tema es requerido' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)

    const cacheKey = hashStr(tema.trim().toLowerCase())
    const cacheFile = `cache_mapa_${cacheKey}.json`

    if (!force) {
      const cachedId = await findFile(accessToken, cacheFile, estructura.notasId)
      if (cachedId) {
        const cached = await readJSON<Record<string, unknown>>(accessToken, cachedId)
        return NextResponse.json({ ...cached, fromCache: true })
      }
    }

    // 1. Búsqueda semántica
    const fragmentos = await semanticSearch(tema, accessToken, { topK: 25 })

    // 2. Agrupar por documentoId, top 8 más frecuentes
    const frecuencia = new Map<string, number>()
    for (const f of fragmentos) {
      frecuencia.set(f.documentoId, (frecuencia.get(f.documentoId) ?? 0) + 1)
    }
    const topDocs = [...frecuencia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id)

    // 3. Cargar fichas en paralelo
    const fichas = await Promise.all(
      topDocs.map(async (docId) => {
        try {
          const fileId = await findFile(accessToken, `ficha_${docId}.json`, estructura.notasId)
          if (!fileId) return null
          return await readJSON<FichaLectura>(accessToken, fileId)
        } catch {
          return null
        }
      })
    )
    const fichasValidas = fichas.filter(Boolean) as FichaLectura[]

    // 4. Construir prompt y llamar a Gemini
    const fragmentosTexto = fragmentos
      .slice(0, 20)
      .map((f, i) => `[${i + 1}] (Doc: ${f.documentoNombre}, Autor: ${f.autor}, Año: ${f.año})\n${f.texto}`)
      .join('\n\n')

    const fichasTexto = fichasValidas
      .map(f => {
        const partes = []
        if (f.tesisCentral) partes.push(`Tesis: ${f.tesisCentral}`)
        if (f.argumentoPrincipal) partes.push(`Argumento: ${f.argumentoPrincipal}`)
        if (f.posicionDebate) partes.push(`Posición: ${f.posicionDebate}`)
        if (f.debatesControversias) partes.push(`Debates: ${f.debatesControversias}`)
        return partes.join('\n')
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    const prompt = `Sos un asistente académico especializado en mapeo de debates intelectuales.

TEMA DE ANÁLISIS: "${tema}"

FRAGMENTOS RELEVANTES DE LA BIBLIOGRAFÍA:
${fragmentosTexto}

FICHAS DE LECTURA:
${fichasTexto}

Analizá los materiales y generá un mapa del debate académico sobre el tema.
Respondé ÚNICAMENTE con JSON puro, sin bloques de código, sin explicaciones adicionales:

{
  "resumenDebate": "síntesis del estado actual del debate en 2-3 oraciones",
  "posiciones": [
    {
      "autor": "nombre del autor",
      "documentoNombre": "título del trabajo",
      "tesis": "tesis central de esta posición",
      "argumentosClave": ["argumento 1", "argumento 2"]
    }
  ],
  "tensiones": [
    {
      "entre": ["Autor A", "Autor B"],
      "sobre": "descripción de la tensión",
      "tipo": "teórica"
    }
  ],
  "acuerdos": ["punto de acuerdo 1", "punto de acuerdo 2"],
  "preguntasAbiertas": ["pregunta 1", "pregunta 2"],
  "sugerenciaInvestigador": "sugerencia concreta para el investigador sobre cómo posicionarse en este debate"
}`

    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent(prompt)
    })
    const text = result.response.text()

    // 5. Parsear JSON limpiando posibles bloques de código
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    const resultado = JSON.parse(cleaned)
    const respuesta = { ...resultado, generadoEn: new Date().toISOString() }
    await writeJSON(accessToken, estructura.notasId, cacheFile, respuesta)
    return NextResponse.json(respuesta)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
