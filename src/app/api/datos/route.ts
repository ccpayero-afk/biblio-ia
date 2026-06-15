import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerDatos } from '@/lib/datos'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { datos } = await leerDatos(accessToken)
    return NextResponse.json(datos)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
