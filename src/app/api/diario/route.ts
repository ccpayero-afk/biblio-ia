import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'diario.json'

interface EntradaDiario {
  id: string
  titulo: string
  contenido: string
  etiquetas: string[]
  creadaEn: string
  actualizadaEn: string
}

async function getLista(accessToken: string): Promise<{ estructura: Awaited<ReturnType<typeof initUserDrive>>; lista: EntradaDiario[]; fileId: string | null }> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  let lista: EntradaDiario[] = []
  if (fileId) {
    try { lista = await readJSON<EntradaDiario[]>(accessToken, fileId) } catch { lista = [] }
  }
  return { estructura, lista, fileId }
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { lista } = await getLista(accessToken)
    const ordenada = [...lista].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    return NextResponse.json(ordenada)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json()
    const { estructura, lista } = await getLista(accessToken)

    const ahora = new Date().toISOString()
    const nueva: EntradaDiario = {
      id: Date.now().toString(),
      titulo: body.titulo ?? '',
      contenido: body.contenido ?? '',
      etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas : [],
      creadaEn: ahora,
      actualizadaEn: ahora,
    }

    await writeJSON(accessToken, estructura.notasId, NOMBRE, [...lista, nueva])
    return NextResponse.json(nueva)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
