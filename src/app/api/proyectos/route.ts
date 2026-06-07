import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Proyecto } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'proyectos.json'

async function getProyectosFileInfo(accessToken: string) {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.proyectosId)
  return { estructura, fileId }
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileId } = await getProyectosFileInfo(accessToken)
    if (!fileId) return NextResponse.json([])
    return NextResponse.json(await readJSON<Proyecto[]>(accessToken, fileId))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const nuevo: Proyecto = await req.json()

    const { estructura, fileId } = await getProyectosFileInfo(accessToken)
    let lista: Proyecto[] = []
    if (fileId) {
      try { lista = await readJSON<Proyecto[]>(accessToken, fileId) } catch { lista = [] }
    }
    lista.push(nuevo)
    await writeJSON(accessToken, estructura.proyectosId, NOMBRE, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
