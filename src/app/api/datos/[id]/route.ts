import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Dato } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'datos.json', estructura.citasId)
    if (!fileId) return NextResponse.json({ ok: true })
    const datos = await readJSON<Dato[]>(accessToken, fileId)
    const nuevos = datos.filter((d) => d.id !== id)
    await writeJSON(accessToken, estructura.citasId, 'datos.json', nuevos)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
