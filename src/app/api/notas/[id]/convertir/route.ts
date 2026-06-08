import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { getGeminiClient } from '@/lib/gemini'
import { convertirNota } from '@/lib/zettel-ia'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'notas.json'

// POST — convierte una nota efímera en permanente usando IA
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
    let lista: Nota[] = []
    if (fileId) {
      try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
    }

    const idx = lista.findIndex((n) => n.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    const nota = lista[idx]
    const genAI = await getGeminiClient(accessToken)
    const sugerencia = await convertirNota(nota.contenido, genAI)

    return NextResponse.json(sugerencia)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
