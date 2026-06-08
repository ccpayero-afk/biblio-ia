import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { readCarpetas, saveCarpetas } from '@/lib/drive'
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    let carpetas = await readCarpetas(accessToken)
    // Eliminar la carpeta y quitarla de subcarpetasIds del padre
    carpetas = carpetas
      .filter((c) => c.id !== id)
      .map((c) => ({
        ...c,
        subcarpetasIds: c.subcarpetasIds.filter((sid) => sid !== id),
      }))

    await saveCarpetas(accessToken, carpetas)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
