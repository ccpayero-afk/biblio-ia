import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { Dato } from '@/types'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'datos.json', estructura.citasId)
    if (!fileId) return NextResponse.json([])
    const datos = await readJSON<Dato[]>(accessToken, fileId)
    return NextResponse.json(Array.isArray(datos) ? datos : [])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
