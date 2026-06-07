import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, writeJSON, findFile } from '@/lib/drive'
import { Cita } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'citas.json'

async function getCitasFile(accessToken: string) {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.citasId)
  return { estructura, fileId }
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileId } = await getCitasFile(accessToken)
    if (!fileId) return NextResponse.json([])
    const citas = await readJSON<Cita[]>(accessToken, fileId)
    return NextResponse.json(citas)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const nuevaCita: Cita = await req.json()

    const { estructura, fileId } = await getCitasFile(accessToken)
    let lista: Cita[] = []
    if (fileId) {
      try { lista = await readJSON<Cita[]>(accessToken, fileId) } catch { lista = [] }
    }
    lista.push(nuevaCita)
    await writeJSON(accessToken, estructura.citasId, NOMBRE, lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
