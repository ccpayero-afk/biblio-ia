import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { cargarCurso, guardarCurso } from '@/lib/aula'
import { semanticSearch } from '@/lib/search'
import { streamWithRotation, GEMINI_MODEL_GENERATION, geminiRateLimitMessage } from '@/lib/gemini'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { leerIndice } from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'
import type { MensajeCurso, Highlight } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { cursoId, mensaje, moduloActual } = await req.json() as {
      cursoId: string
      mensaje: string
      moduloActual: number
    }

    if (!cursoId || !mensaje?.trim()) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const curso = await cargarCurso(accessToken, cursoId)
    const modulo = curso.plan.find((m) => m.numero === moduloActual) ?? curso.plan[0]

    // RAG: only within this book
    const [fragmentos, estructuraDrive] = await Promise.all([
      semanticSearch(mensaje, accessToken, { documentoIds: [curso.libroId], topK: 5 }),
      initUserDrive(accessToken),
    ])

    const contextoRAG = fragmentos.length
      ? fragmentos.map((f, i) => `[${i + 1}] p.${f.pagina}: "${f.texto}"`).join('\n')
      : ''

    // Highlights y notas del estudiante sobre este libro
    let contextoAlumno = ''
    try {
      const [highlightsFileId, { indice }] = await Promise.all([
        findFile(accessToken, `${curso.libroId}.json`, estructuraDrive.highlightsId),
        leerIndice(accessToken),
      ])
      const highlights: Highlight[] = highlightsFileId
        ? await readJSON<Highlight[]>(accessToken, highlightsFileId).catch(() => [])
        : []
      const notasDelLibro = indice.filter((n) => (n as { documentoOrigenId?: string }).documentoOrigenId === curso.libroId)

      const partes: string[] = []
      if (highlights.length) {
        partes.push(`Highlights del estudiante (${highlights.length}):\n` +
          highlights.slice(0, 10).map(h => `• p.${h.pagina}: "${h.texto.slice(0, 120)}"${h.nota ? ` [nota: ${h.nota}]` : ''}`).join('\n'))
      }
      if (notasDelLibro.length) {
        partes.push(`Notas Zettelkasten del estudiante sobre este libro:\n` +
          notasDelLibro.slice(0, 8).map(n => `• ${n.titulo}`).join('\n'))
      }
      if (partes.length) contextoAlumno = partes.join('\n\n')
    } catch { /* si falla, continúa sin este contexto */ }

    const sistema = `Eres el docente pedagógico del curso sobre "${curso.libroTitulo}" de ${curso.libroAutor}.

Tu misión es enseñar de forma clara, profunda y pedagógica aplicando estas estrategias:
- Explicás los conceptos usando ejemplos concretos, analogías y comparaciones
- Hacés preguntas socráticas para verificar y profundizar la comprensión
- Relacionás los conceptos del libro con situaciones actuales y otros conocimientos
- Evaluás respuestas dando feedback constructivo, señalando aciertos y áreas de mejora
- Usás un tono cercano, entusiasta e inspirador de curiosidad intelectual
- Citás partes del libro cuando es pertinente para ilustrar los puntos

Módulo actual: ${modulo.numero} — "${modulo.titulo}"
Objetivos: ${modulo.objetivos.join('; ')}
Temas clave: ${modulo.temas.join(', ')}`

    const partes = []
    if (contextoRAG) partes.push(`Fragmentos relevantes del libro:\n${contextoRAG}`)
    if (contextoAlumno) partes.push(contextoAlumno)
    partes.push(`Estudiante: ${mensaje}`)
    const promptConContexto = partes.join('\n\n')

    const history = curso.conversacion.slice(-16).map((m) => ({
      role: m.rol === 'usuario' ? 'user' : 'model' as 'user' | 'model',
      parts: [{ text: m.contenido }],
    }))

    const encoder = new TextEncoder()
    let respuestaCompleta = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of streamWithRotation(accessToken, async function* (genAI) {
            const model = genAI.getGenerativeModel({
              model: GEMINI_MODEL_GENERATION,
              systemInstruction: sistema,
            })
            const chat = model.startChat({ history })
            const result = await chat.sendMessageStream(promptConContexto)
            for await (const chunk of result.stream) {
              const t = chunk.text()
              if (t) yield t
            }
          })) {
            respuestaCompleta += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: text })}\n\n`))
          }

          // Save conversation to Drive
          const ahora = new Date().toISOString()
          const nuevosMensajes: MensajeCurso[] = [
            { rol: 'usuario', contenido: mensaje, timestamp: ahora },
            { rol: 'docente', contenido: respuestaCompleta, timestamp: ahora },
          ]
          const cursoActualizado = {
            ...curso,
            moduloActual,
            conversacion: [...curso.conversacion, ...nuevosMensajes],
          }
          await guardarCurso(accessToken, cursoActualizado, cursoId)

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
          const rl = geminiRateLimitMessage(e)
          const msg = rl ?? (e instanceof Error ? e.message : String(e))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
