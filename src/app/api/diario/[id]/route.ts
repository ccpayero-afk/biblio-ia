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

async function getLista(accessToken: string) {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  let lista: EntradaDiario[] = []
  if (fileId) {
    try { lista = await readJSON<EntradaDiario[]>(accessToken, fileId) } catch { lista = [] }
  }
  return { estructura, lista }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const body = await req.json()
    const { estructura, lista } = await getLista(accessToken)

    const idx = lista.findIndex((e) => e.id === id)
    if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    lista[idx] = {
      ...lista[idx],
      titulo: body.titulo ?? lista[idx].titulo,
      contenido: body.contenido ?? lista[idx].contenido,
      etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas : lista[idx].etiquetas,
      actualizadaEn: new Date().toISOString(),
    }

    await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
    return NextResponse.json(lista[idx])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const { estructura, lista } = await getLista(accessToken)

    const nuevaLista = lista.filter((e) => e.id !== id)
    await writeJSON(accessToken, estructura.notasId, NOMBRE, nuevaLista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
