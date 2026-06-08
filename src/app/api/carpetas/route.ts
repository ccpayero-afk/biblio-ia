import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { readCarpetas, saveCarpetas, listPDFs, initUserDrive } from '@/lib/drive'
import { Carpeta } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const [carpetas, estructura] = await Promise.all([
      readCarpetas(accessToken),
      initUserDrive(accessToken),
    ])
    const documentos = await listPDFs(accessToken, estructura.pdfsId)

    // Enriquecer conteos reales desde los documentos
    const carpetasConConteo = carpetas.map((c) => ({
      ...c,
      documentosIds: documentos.filter((d) => d.carpetaId === c.id).map((d) => d.id),
    }))

    return NextResponse.json(carpetasConConteo)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json()

    const carpetas = await readCarpetas(accessToken)
    const nueva: Carpeta = {
      id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      nombre: body.nombre ?? 'Nueva carpeta',
      descripcion: body.descripcion,
      color: body.color ?? 'blue',
      icono: body.icono,
      carpetaPadreId: body.carpetaPadreId,
      documentosIds: [],
      subcarpetasIds: [],
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      orden: carpetas.length,
    }

    if (nueva.carpetaPadreId) {
      const padreIdx = carpetas.findIndex((c) => c.id === nueva.carpetaPadreId)
      if (padreIdx !== -1) {
        carpetas[padreIdx] = {
          ...carpetas[padreIdx],
          subcarpetasIds: [...carpetas[padreIdx].subcarpetasIds, nueva.id],
        }
      }
    }

    carpetas.push(nueva)
    await saveCarpetas(accessToken, carpetas)
    return NextResponse.json(nueva)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
