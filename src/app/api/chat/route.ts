export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { askLibrary, MensajeHistorial } from '@/lib/chat'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { query, documentoIds, carpetasIds, historial = [], añoDesde, añoHasta } = await req.json() as {
      query: string
      documentoIds?: string[]
      carpetasIds?: string[]
      historial?: MensajeHistorial[]
      añoDesde?: string
      añoHasta?: string
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Falta la pregunta' }, { status: 400 })
    }

    // Resolver carpetasIds a documentoIds si se proveen
    let filteredDocIds = documentoIds
    if (carpetasIds?.length) {
      const estructura = await initUserDrive(accessToken)
      const todos = await listPDFs(accessToken, estructura.pdfsId)
      filteredDocIds = todos
        .filter((d) => carpetasIds.includes(d.carpetaId ?? '__sin_carpeta__'))
        .map((d) => d.id)
    }

    // Búsqueda semántica — multi-query expansion cubre ~20 documentos distintos
    const fragmentos = await semanticSearch(query, accessToken, { documentoIds: filteredDocIds, topK: 60, añoDesde, añoHasta })

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
