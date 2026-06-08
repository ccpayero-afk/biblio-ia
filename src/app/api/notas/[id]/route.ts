import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'notas.json'

async function getLista(accessToken: string): Promise<{ estructura: Awaited<ReturnType<typeof import('@/lib/drive').initUserDrive>>; lista: Nota[]; fileId: string | null }> {
  const { initUserDrive, findFile, readJSON } = await import('@/lib/drive')
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  let lista: Nota[] = []
  if (fileId) {
    try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
  }
  return { estructura, lista, fileId }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const { lista } = await getLista(accessToken)
    const nota = lista.find((n) => n.id === id)
    if (!nota) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(nota)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const body = await req.json()

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
    let lista: Nota[] = []
    if (fileId) {
      try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
    }

    const idx = lista.findIndex((n) => n.id === id)
    if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    lista[idx] = { ...lista[idx], ...body, id, actualizadaEn: new Date().toISOString() }
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

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
    let lista: Nota[] = []
    if (fileId) {
      try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
    }

    // Eliminar la nota y limpiar vínculos que apunten a ella
    lista = lista
      .filter((n) => n.id !== id)
      .map((n) => ({
        ...n,
        vinculos: (n.vinculos ?? []).filter((v) => v.notaDestinoId !== id),
      }))

    await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
