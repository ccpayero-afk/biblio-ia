import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, writeJSON, findFile } from '@/lib/drive'
import { Highlight } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

async function getHighlightsFile(accessToken: string, documentoId: string) {
  const estructura = await initUserDrive(accessToken)
  const nombre = `${documentoId}.json`
  const fileId = await findFile(accessToken, nombre, estructura.highlightsId)
  return { estructura, nombre, fileId }
}

export async function GET(_req: Request, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { documentoId } = await params
    const { fileId } = await getHighlightsFile(accessToken, documentoId)
    if (!fileId) return NextResponse.json([])
    const highlights = await readJSON<Highlight[]>(accessToken, fileId)
    return NextResponse.json(highlights)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { documentoId } = await params
    const nuevoHighlight: Highlight = await req.json()

    const { estructura, nombre, fileId } = await getHighlightsFile(accessToken, documentoId)
    let lista: Highlight[] = []
    if (fileId) {
      try { lista = await readJSON<Highlight[]>(accessToken, fileId) } catch { lista = [] }
    }
    lista.push(nuevoHighlight)
    await writeJSON(accessToken, estructura.highlightsId, nombre, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { documentoId } = await params
    const { highlightId } = await req.json()

    const { estructura, nombre, fileId } = await getHighlightsFile(accessToken, documentoId)
    if (!fileId) return NextResponse.json({ ok: true })
    let lista: Highlight[] = await readJSON<Highlight[]>(accessToken, fileId)
    lista = lista.filter((h) => h.id !== highlightId)
    await writeJSON(accessToken, estructura.highlightsId, nombre, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
