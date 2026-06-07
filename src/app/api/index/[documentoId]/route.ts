import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { indexDocument } from '@/lib/indexer'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { documentoId } = await params

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(msg: string, paso: number, total: number) {
        const data = JSON.stringify({ msg, paso, total })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        const fragmentos = await indexDocument(documentoId, accessToken, send)
        const done = JSON.stringify({ done: true, fragmentos })
        controller.enqueue(encoder.encode(`data: ${done}\n\n`))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[Indexación error]', msg)
        // Marcar como error en Drive
        try {
          await updateDocumentMetadata(accessToken, documentoId, { estado: 'error' })
        } catch {}
        const err = JSON.stringify({ error: msg })
        controller.enqueue(encoder.encode(`data: ${err}\n\n`))
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
}
