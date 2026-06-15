import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerNota } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { convertirNota } from '@/lib/zettel-ia'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST — convierte una nota efímera en permanente usando IA
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    const nota = await leerNota(accessToken, id)
    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    const sugerencia = await generateWithRotation(accessToken, (genAI) =>
      convertirNota(nota.contenido, genAI)
    )
    return NextResponse.json(sugerencia)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
