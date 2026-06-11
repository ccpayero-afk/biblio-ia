import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { readCarpetas, saveCarpetas } from '@/lib/drive'
import { Carpeta } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const body = await req.json()

    const carpetas = await readCarpetas(accessToken)
    const idx = carpetas.findIndex((c) => c.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 404 })

    carpetas[idx] = {
      ...carpetas[idx],
      ...body,
      id, // no permitir cambiar el id
      actualizadaEn: new Date().toISOString(),
    }
    await saveCarpetas(accessToken, carpetas)
    return NextResponse.json(carpetas[idx])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function getSubtreeIds(carpetaId: string, carpetas: Carpeta[]): string[] {
  const hijos = carpetas.filter((c) => c.carpetaPadreId === carpetaId)
  return [carpetaId, ...hijos.flatMap((h) => getSubtreeIds(h.id, carpetas))]
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const subtree = new URL(req.url).searchParams.get('subtree') === 'true'

    let carpetas = await readCarpetas(accessToken)

    // Con subtree=true eliminamos la carpeta + todas sus subcarpetas
    const idsToDelete = new Set(subtree ? getSubtreeIds(id, carpetas) : [id])

    carpetas = carpetas
      .filter((c) => !idsToDelete.has(c.id))
      .map((c) => ({
        ...c,
        subcarpetasIds: c.subcarpetasIds.filter((sid) => !idsToDelete.has(sid)),
      }))

    await saveCarpetas(accessToken, carpetas)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
