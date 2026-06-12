import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const fileId = await findFile(accessToken, 'conversaciones.json', estructura.notasId)
    if (!fileId) return NextResponse.json([])

    const data = await readJSON<unknown[]>(accessToken, fileId)
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const conversaciones = await req.json()
    if (!Array.isArray(conversaciones)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    await writeJSON(accessToken, estructura.notasId, 'conversaciones.json', conversaciones.slice(0, 30))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
