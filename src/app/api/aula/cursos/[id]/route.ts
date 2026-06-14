import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { cargarCurso, guardarCurso, eliminarCurso } from '@/lib/aula'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const curso = await cargarCurso(accessToken, params.id)
    return NextResponse.json({ id: params.id, ...curso })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { moduloActual } = await req.json() as { moduloActual: number }

    const curso = await cargarCurso(accessToken, params.id)
    await guardarCurso(accessToken, { ...curso, moduloActual }, params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    await eliminarCurso(accessToken, params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
