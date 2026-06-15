import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { eliminarCita } from '@/lib/citas'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    await eliminarCita(accessToken, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
