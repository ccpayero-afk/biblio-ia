import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { generateFicha, saveFicha } from '@/lib/ficha'
import { Fragmento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
    if (!fileId) return NextResponse.json(null)
    return NextResponse.json(await readJSON(accessToken, fileId))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { documentoNombre, autor, año } = await req.json()

    // Load embeddings for this document
    const estructura = await initUserDrive(accessToken)
    const embeddingsFileId = await findFile(accessToken, 'embeddings.json', estructura.indexId)
    let fragmentos: Fragmento[] = []
    if (embeddingsFileId) {
      const todos = await readJSON<Fragmento[]>(accessToken, embeddingsFileId)
      fragmentos = todos.filter((f) => f.documentoId === documentoId)
    }

    if (!fragmentos.length) {
      return NextResponse.json({ error: 'El documento no tiene fragmentos indexados. Indexalo primero.' }, { status: 400 })
    }

    const ficha = await generateFicha(documentoId, documentoNombre, autor, año, fragmentos, accessToken)
    await saveFicha(ficha, accessToken)
    return NextResponse.json(ficha)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('429') || msg.includes('Too Many Requests')) {
      const retryMatch = msg.match(/retry[^"]*?(\d+)[s"]/)
      const segundos = retryMatch ? retryMatch[1] : null
      const espera = segundos ? ` Reintentá en ${segundos} segundos.` : ' Esperá unos segundos y reintentá.'
      return NextResponse.json({
        error: `Gemini está limitando las solicitudes (rate limit).${espera} Si el problema persiste, revisá tu cuota en Google AI Studio.`,
      }, { status: 429 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
