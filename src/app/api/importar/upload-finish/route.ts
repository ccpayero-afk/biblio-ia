import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

interface Meta {
  autor?: string
  año?: string
  editorial?: string
  etiquetas?: string[]
}

// POST { fileId, meta? } → { ok, id }
// Called after the client has finished uploading directly to Drive.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileId, meta } = await req.json() as { fileId: string; meta?: Meta }

    await updateDocumentMetadata(accessToken, fileId, {
      autor: meta?.autor ?? '',
      año: meta?.año ?? '',
      editorial: meta?.editorial ?? '',
      etiquetas: meta?.etiquetas ?? [],
    })

    return NextResponse.json({ ok: true, id: fileId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
