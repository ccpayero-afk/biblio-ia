import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/carpetas/[id]/mover — body: { documentoId }
// Mueve un documento a la carpeta [id]. Si id es "sin-carpeta", quita la asignación.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const { documentoId } = await req.json()

    if (!documentoId) return NextResponse.json({ error: 'documentoId requerido' }, { status: 400 })

    const carpetaId = id === 'sin-carpeta' ? '' : id
    await updateDocumentMetadata(accessToken, documentoId, { carpetaId: carpetaId || undefined })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
