import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { downloadPDFBuffer } from '@/lib/indexer'
import { extraerMetadatos } from '@/lib/metadatos'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)

    const buffer = await downloadPDFBuffer(accessToken, documentoId)
    const metadatos = await extraerMetadatos(buffer)

    // Solo guardar campos no vacíos
    const actualizados: string[] = []
    const updates: Parameters<typeof updateDocumentMetadata>[2] = {}

    if (metadatos.autor?.trim()) { updates.autor = metadatos.autor.trim(); actualizados.push('autor') }
    if (metadatos.año?.trim())   { updates.año = metadatos.año.trim();     actualizados.push('año') }
    if (metadatos.editorial?.trim()) {
      updates.editorial = metadatos.editorial.trim().slice(0, 100)
      actualizados.push('editorial')
    }
    if (metadatos.abstract?.trim()) {
      updates.abstract = metadatos.abstract.trim().slice(0, 120)
      actualizados.push('abstract')
    }
    if (metadatos.doi?.trim()) { updates.doi = metadatos.doi.trim(); actualizados.push('doi') }

    if (actualizados.length > 0) {
      await updateDocumentMetadata(accessToken, documentoId, updates)
    }

    return NextResponse.json({ ok: true, metadatos, actualizados, fuente: metadatos.fuente })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
