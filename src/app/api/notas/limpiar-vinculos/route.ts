import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Nota } from '@/types'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    if (!fileId) return NextResponse.json({ ok: true, limpiadas: 0 })

    let lista: Nota[] = []
    try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }

    const limpiadas = lista.filter((n) => (n.vinculos ?? []).length > 0).length
    lista = lista.map((n) => ({ ...n, vinculos: [] }))
    await writeJSON(accessToken, estructura.notasId, 'notas.json', lista)
    return NextResponse.json({ ok: true, limpiadas })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
