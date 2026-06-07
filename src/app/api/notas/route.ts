import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'notas.json'

async function getNotasFileId(accessToken: string) {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  return { estructura, fileId }
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileId } = await getNotasFileId(accessToken)
    if (!fileId) return NextResponse.json([])
    return NextResponse.json(await readJSON<Nota[]>(accessToken, fileId))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const nuevaNota: Nota = await req.json()

    const { estructura, fileId } = await getNotasFileId(accessToken)
    let lista: Nota[] = []
    if (fileId) {
      try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
    }
    lista.push(nuevaNota)
    await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
