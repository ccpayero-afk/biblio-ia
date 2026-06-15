import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, escribirIndice } from '@/lib/notas'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { notasId, indice } = await leerIndice(accessToken)
    const limpiadas = indice.filter((n) => (n.vinculos ?? []).length > 0).length
    const nueva = indice.map((n) => ({ ...n, vinculos: [] }))
    await escribirIndice(accessToken, notasId, nueva)
    return NextResponse.json({ ok: true, limpiadas })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
