export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON, updateDocumentMetadata } from '@/lib/drive'
import { generateFicha, saveFicha } from '@/lib/ficha'
import { geminiRateLimitMessage } from '@/lib/gemini'
import { Fragmento, FichaLectura } from '@/types'
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const updates = await req.json() as Partial<FichaLectura>

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
    if (!fileId) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

    const existing = await readJSON<FichaLectura>(accessToken, fileId)
    const updated: FichaLectura = { ...existing, ...updates, documentoId, generadaEn: existing.generadaEn }
    await writeJSON(accessToken, estructura.notasId, `ficha_${documentoId}.json`, updated)
    return NextResponse.json(updated)
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
    let fragmentos: Fragmento[] = []
    const embFileId = await findFile(accessToken, `emb_${documentoId}.json`, estructura.indexId)
    if (embFileId) {
      fragmentos = await readJSON<Fragmento[]>(accessToken, embFileId)
    }

    if (!fragmentos.length) {
      return NextResponse.json({ error: 'El documento no tiene fragmentos indexados. Indexalo primero.' }, { status: 400 })
    }

    const ficha = await generateFicha(documentoId, documentoNombre, autor, año, fragmentos, accessToken)
    await saveFicha(ficha, accessToken)
    await updateDocumentMetadata(accessToken, documentoId, { fichaGenerada: true })
    return NextResponse.json(ficha)
  } catch (e) {
    const rateLimitMsg = geminiRateLimitMessage(e)
    if (rateLimitMsg) {
      return NextResponse.json({ error: rateLimitMsg }, { status: 429 })
    }
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
