import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { semanticSearch } from '@/lib/search'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { tema } = await req.json() as { tema: string; carpetasIds?: string[] }

    if (!tema?.trim()) {
      return NextResponse.json({ error: 'El campo tema es requerido' }, { status: 400 })
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
    const estructura = await initUserDrive(accessToken)
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

    const gemini = await getGeminiClient(accessToken)
    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // 5. Parsear JSON limpiando posibles bloques de código
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    const resultado = JSON.parse(cleaned)
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
