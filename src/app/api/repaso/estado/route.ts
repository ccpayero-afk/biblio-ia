import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'

interface CardState {
  interval: number
  ease: number
  due: string
  reviews: number
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'repaso_estado.json', estructura.notasId)
    if (!fileId) return NextResponse.json({})
    const estado = await readJSON<Record<string, CardState>>(accessToken, fileId)
    return NextResponse.json(estado)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { estado } = await req.json() as { estado: Record<string, CardState> }
    const estructura = await initUserDrive(accessToken)
    await writeJSON(accessToken, estructura.notasId, 'repaso_estado.json', estado)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
