import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { getGeminiClient } from '@/lib/gemini'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const NOMBRE = 'notas.json'

// POST — body: { nota } — devuelve sugerencias de vínculos IA
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { nota } = await req.json() as { nota: Nota }

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
    let todasLasNotas: Nota[] = []
    if (fileId) {
      try { todasLasNotas = await readJSON<Nota[]>(accessToken, fileId) } catch { todasLasNotas = [] }
    }

    const genAI = await getGeminiClient(accessToken)
    const sugerencias = await sugerirVinculos(nota, todasLasNotas, genAI)

    return NextResponse.json(sugerencias)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
