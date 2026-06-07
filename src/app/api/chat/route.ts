import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { askLibrary, MensajeHistorial } from '@/lib/chat'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { query, documentoIds, historial = [] } = await req.json() as {
      query: string
      documentoIds?: string[]
      historial?: MensajeHistorial[]
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Falta la pregunta' }, { status: 400 })
    }

    // Búsqueda semántica
    const fragmentos = await semanticSearch(query, accessToken, { documentoIds })

    // Streaming de la respuesta
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Enviar fuentes primero
          const fuentes = fragmentos.map((f) => ({
            documentoId: f.documentoId,
            documentoNombre: f.documentoNombre,
            autor: f.autor,
            año: f.año,
            pagina: f.pagina,
            fragmentoId: f.id,
          }))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ fuentes })}\n\n`))

          // Streamear texto de Gemini
          for await (const chunk of askLibrary(query, fragmentos, accessToken, historial)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: chunk })}\n\n`))
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
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
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
