import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'
import type { Recomendacion } from '../route'

const MAX_SESIONES = 15
const FILENAME = 'sesiones_enriquecimiento.json'

export interface SesionEnriquecer {
  id: string
  fecha: string
  textoGuardado: string
  analisis: string
  recomendaciones: Recomendacion[]
  fragmentosIncluidos: number
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, FILENAME, estructura.notasId)
    if (!fileId) return NextResponse.json([])
    const sesiones = await readJSON<SesionEnriquecer[]>(accessToken, fileId)
    return NextResponse.json(Array.isArray(sesiones) ? sesiones : [])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const nueva = (await req.json()) as SesionEnriquecer
    const fileId = await findFile(accessToken, FILENAME, estructura.notasId)
    const actuales = fileId ? await readJSON<SesionEnriquecer[]>(accessToken, fileId).catch(() => []) : []
    const lista = Array.isArray(actuales) ? actuales : []
    const guardadas = [nueva, ...lista.filter((s) => s.id !== nueva.id)].slice(0, MAX_SESIONES)
    await writeJSON(accessToken, estructura.notasId, FILENAME, guardadas)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const { id } = (await req.json()) as { id: string }
    const fileId = await findFile(accessToken, FILENAME, estructura.notasId)
    if (!fileId) return NextResponse.json({ ok: true })
    const lista = await readJSON<SesionEnriquecer[]>(accessToken, fileId).catch(() => [])
    await writeJSON(
      accessToken,
      estructura.notasId,
      FILENAME,
      (Array.isArray(lista) ? lista : []).filter((s) => s.id !== id)
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
