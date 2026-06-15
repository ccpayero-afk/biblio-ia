import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerTodasCompletas } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST — body: { nota } — devuelve sugerencias de vínculos IA
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { nota } = await req.json() as { nota: Nota }

    const todasLasNotas = await leerTodasCompletas(accessToken)
    const sugerencias = await generateWithRotation(accessToken, (genAI) =>
      sugerirVinculos(nota, todasLasNotas, genAI)
    )
    return NextResponse.json(sugerencias)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
