import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerCitas, agregarCita } from '@/lib/citas'
import { Cita } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { citas } = await leerCitas(accessToken)
    return NextResponse.json(citas)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const nuevaCita: Cita = await req.json()
    const { duplicado, citaExistente } = await agregarCita(accessToken, nuevaCita)
    return NextResponse.json({ ok: true, duplicado, citaExistente })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
