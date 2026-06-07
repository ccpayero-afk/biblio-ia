import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, writeJSON, findFile } from '@/lib/drive'
import { Cita } from '@/types'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    if (!fileId) return NextResponse.json({ ok: true })

    let lista: Cita[] = await readJSON<Cita[]>(accessToken, fileId)
    lista = lista.filter((c) => c.id !== id)
    await writeJSON(accessToken, estructura.citasId, 'citas.json', lista)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
