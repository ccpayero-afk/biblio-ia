import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { cargarCurso, guardarCurso, eliminarCurso } from '@/lib/aula'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const curso = await cargarCurso(accessToken, id)
    return NextResponse.json({ id, ...curso })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { moduloActual } = await req.json() as { moduloActual: number }

    const curso = await cargarCurso(accessToken, id)
    await guardarCurso(accessToken, { ...curso, moduloActual }, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    await eliminarCurso(accessToken, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
