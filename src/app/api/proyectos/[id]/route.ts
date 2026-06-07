import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Proyecto } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'proyectos.json'

async function getProyectos(accessToken: string): Promise<{ lista: Proyecto[]; estructura: Awaited<ReturnType<typeof initUserDrive>> }> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.proyectosId)
  let lista: Proyecto[] = []
  if (fileId) {
    try { lista = await readJSON<Proyecto[]>(accessToken, fileId) } catch { lista = [] }
  }
  return { lista, estructura }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { lista } = await getProyectos(accessToken)
    const proyecto = lista.find((p) => p.id === id)
    if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(proyecto)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const actualizado: Proyecto = await req.json()

    const { lista, estructura } = await getProyectos(accessToken)
    const idx = lista.findIndex((p) => p.id === id)
    if (idx === -1) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    lista[idx] = { ...actualizado, actualizadoEn: new Date().toISOString() }
    await writeJSON(accessToken, estructura.proyectosId, NOMBRE, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { lista, estructura } = await getProyectos(accessToken)
    const nuevaLista = lista.filter((p) => p.id !== id)
    await writeJSON(accessToken, estructura.proyectosId, NOMBRE, nuevaLista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
