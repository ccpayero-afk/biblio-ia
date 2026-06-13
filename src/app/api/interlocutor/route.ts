import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { MensajeHistorial } from '@/lib/chat'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

type Modo = 'exploración' | 'posicion' | 'debate' | 'socrático'

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
    } = (await req.json()) as { query: string; modo?: Modo; historial?: MensajeHistorial[]; carpetasIds?: string[] }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Falta la pregunta' }, { status: 400 })
    }

    let filteredDocIds: string[] | undefined
    if (carpetasIds?.length) {
      const estructura = await initUserDrive(accessToken)
      const todos = await listPDFs(accessToken, estructura.pdfsId)
      filteredDocIds = todos
        .filter((d) => carpetasIds.includes(d.carpetaId ?? '__sin_carpeta__'))
        .map((d) => d.id)
    }

    const fragmentos = await semanticSearch(query, accessToken, { topK: 6, documentoIds: filteredDocIds })
    const contexto = fragmentos
      .map((f, i) => `[${i + 1}] ${f.autor || 'Autor'} (${f.año || 's.f.'}), p.${f.pagina}:\n"${f.texto}"`)
      .join('\n\n')

    const sistema = SISTEMAS[modo] ?? SISTEMAS['exploración']

    const genAI = await getGeminiClient(accessToken)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_GENERATION,
      systemInstruction: sistema,
    })

    const chat = model.startChat({
      history: historial.map((m) => ({
        role: m.rol === 'user' ? 'user' : 'model',
        parts: [{ text: m.contenido }],
      })),
    })

    const prompt = fragmentos.length
      ? `FRAGMENTOS DE LA BIBLIOTECA:\n\n${contexto}\n\n---\nPREGUNTA: ${query}`
      : query

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
          const result = await chat.sendMessageStream(prompt)
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
