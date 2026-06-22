export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { MensajeHistorial } from '@/lib/chat'
import { initUserDrive, listPDFs, findFile, readJSON } from '@/lib/drive'
import { FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

type Modo = 'exploración' | 'posicion' | 'debate' | 'socrático'

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

const SISTEMAS: Record<Modo, string> = {
  exploración: `Sos un guía de exploración teórica. Tu rol es ayudar al investigador a navegar la bibliografía con preguntas que amplíen su comprensión.
Tras cada respuesta planteás UNA pregunta de seguimiento que profundice la exploración.
Citás siempre las fuentes con (Autor, Año, p. N). Español académico.`,

  posicion: `Sos el representante de los autores de la biblioteca. Respondés en primera persona plural del autor principal mencionado, reproduciendo fielmente su posición teórica.
Si te hacen una pregunta, respondés como respondería ese autor, basándote en los fragmentos disponibles.
Citás textualmente cuando corresponde. Español académico.`,

  debate: `Sos un moderador de debate académico. Presentás las POSICIONES EN TENSIÓN que existen en la bibliografía sobre el tema preguntado.
Identificás qué autores defienden cada posición y qué argumentos usan. Señalás los puntos de acuerdo y desacuerdo.
Español académico, estructura clara.`,

  socrático: `Sos un interlocutor socrático. Nunca respondés directamente: hacés preguntas que lleven al investigador a descubrir las respuestas por sí mismo.
Tus preguntas parten de los fragmentos de la biblioteca. Cuando el investigador formula algo, pedís que lo elabore o desafíe su premisa.
Español académico.`,
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const {
      query,
      modo = 'exploración',
      historial = [],
      carpetasIds,
      documentoId,
    } = (await req.json()) as { query: string; modo?: Modo; historial?: MensajeHistorial[]; carpetasIds?: string[]; documentoId?: string }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Falta la pregunta' }, { status: 400 })
    }

    let filteredDocIds: string[] | undefined
    if (carpetasIds?.length) {
      const estructuraCarpetas = await initUserDrive(accessToken)
      const todos = await listPDFs(accessToken, estructuraCarpetas.pdfsId)
      filteredDocIds = todos
        .filter((d) => carpetasIds.includes(d.carpetaId ?? '__sin_carpeta__'))
        .map((d) => d.id)
    }

    // Para modo posicion con documento seleccionado: restringir búsqueda al documento
    let searchDocIds = filteredDocIds
    if (modo === 'posicion' && documentoId) {
      searchDocIds = [documentoId]
    }

    const fragmentos = await semanticSearch(query, accessToken, { topK: 15, documentoIds: searchDocIds })
    const contexto = fragmentos
      .map((f, i) => `[${i + 1}] ${f.autor || 'Autor'} (${f.año || 's.f.'}), p.${f.pagina}:\n"${f.texto}"`)
      .join('\n\n')

    let sistema = SISTEMAS[modo] ?? SISTEMAS['exploración']

    // En modo debate: intentar cargar el mapa de debates cacheado para este tema
    if (modo === 'debate') {
      try {
        const estructura = await initUserDrive(accessToken)
        const cacheKey = hashStr(query.trim().toLowerCase())
        const cacheFile = `cache_mapa_${cacheKey}.json`
        const cachedId = await findFile(accessToken, cacheFile, estructura.notasId)
        if (cachedId) {
          const mapa = await readJSON<Record<string, unknown>>(accessToken, cachedId)
          const posiciones = (mapa.posiciones as { autor: string; tesis: string }[] | undefined) ?? []
          const tensiones = (mapa.tensiones as { entre: string[]; sobre: string }[] | undefined) ?? []
          const acuerdos = (mapa.acuerdos as string[] | undefined) ?? []
          if (posiciones.length || tensiones.length) {
            const mapaStr = [
              posiciones.length ? `POSICIONES:\n${posiciones.map(p => `• ${p.autor}: "${p.tesis}"`).join('\n')}` : '',
              tensiones.length ? `TENSIONES:\n${tensiones.map(t => `• ${t.entre.join(' vs ')}: ${t.sobre}`).join('\n')}` : '',
              acuerdos.length ? `ACUERDOS: ${acuerdos.join(' / ')}` : '',
            ].filter(Boolean).join('\n\n')
            sistema = `${SISTEMAS['debate']}\n\nMapa del debate disponible:\n${mapaStr}`
          }
        }
      } catch { /* si falla, usa sistema genérico */ }
    }

    // Enriquecer sistema prompt cuando hay documento seleccionado en modo posicion
    if (modo === 'posicion' && documentoId) {
      try {
        const estructura = await initUserDrive(accessToken)
        const fichaFileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
        if (fichaFileId) {
          const ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)
          const docNombre = fragmentos[0]?.documentoNombre ?? documentoId
          const autorLabel = ficha.tesisCentral ? (fragmentos[0]?.autor || 'el autor del texto') : `el autor del texto "${docNombre}"`
          const conceptosStr = ficha.conceptosClave?.slice(0, 3)
            .map(c => `"${c.concepto}": ${c.definicion}`)
            .join(' / ') ?? ''
          sistema = `Sos ${autorLabel}.

Tu obra central: "${ficha.tesisCentral}"

Tu argumento: "${ficha.argumentoPrincipal}"

Tu marco teórico: "${ficha.marcoTeorico ?? 'no especificado'}"

Tu posición en el debate: "${ficha.posicionDebate ?? 'no especificada'}"
${conceptosStr ? `\nConceptos que usás: ${conceptosStr}` : ''}

Respondés en primera persona como este autor, defendiendo estas ideas con los fragmentos disponibles. Citás tu propia obra cuando corresponde. Español académico.`
        }
      } catch {
        // Si falla la carga de ficha, usar sistema genérico
      }
    }

    const prompt = fragmentos.length
      ? `FRAGMENTOS DE LA BIBLIOTECA:\n\n${contexto}\n\n---\nPREGUNTA: ${query}`
      : query

    const historialParaChat = historial.map((m) => ({
      role: m.rol === 'user' ? 'user' : 'model',
      parts: [{ text: m.contenido }],
    }))

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const fuentes = fragmentos.map((f) => ({
          documentoId: f.documentoId,
          documentoNombre: f.documentoNombre,
          autor: f.autor,
          año: f.año,
          pagina: f.pagina,
        }))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ fuentes })}\n\n`))
        try {
          const result = await generateWithRotation(accessToken, async (genAI) => {
            const model = genAI.getGenerativeModel({
              model: GEMINI_MODEL_GENERATION,
              systemInstruction: sistema,
            })
            const chat = model.startChat({ history: historialParaChat })
            return chat.sendMessageStream(prompt)
          })
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: text })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
