import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { eliminarDato } from '@/lib/datos'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    await eliminarDato(accessToken, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
