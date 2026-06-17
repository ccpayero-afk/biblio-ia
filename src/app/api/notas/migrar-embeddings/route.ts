import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, leerContenido } from '@/lib/notas'
import { leerEmbeddingsNotas, generarEmbeddingTexto } from '@/lib/notas-emb'
import { initUserDrive, writeJSON, findFile } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const EMB_FILE = 'notas_emb.json'
const POR_LLAMADA = 10  // notes per API call (each takes ~1-2s to embed)

// GET /api/notas/migrar-embeddings — returns counts without processing
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { indice } = await leerIndice(accessToken)
    const elegibles = indice.filter(
      (n) => n.tipo !== 'efimera' && !(n as typeof n & { eliminadaEn?: string }).eliminadaEn
    )
    const embeddings = await leerEmbeddingsNotas(accessToken)
    const sinEmbedding = elegibles.filter((n) => !embeddings[n.id]).length

    return NextResponse.json({ total: elegibles.length, sinEmbedding, conEmbedding: elegibles.length - sinEmbedding })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/notas/migrar-embeddings — processes one batch, call in a loop until restantes === 0
export async function POST(_req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { notasId, indice } = await leerIndice(accessToken)
    const elegibles = indice.filter(
      (n) => n.tipo !== 'efimera' && !(n as typeof n & { eliminadaEn?: string }).eliminadaEn
    )

    // Load existing embeddings so we don't regenerate what's already done
    const { notasId: nId } = await initUserDrive(accessToken)
    const embFileId = await findFile(accessToken, EMB_FILE, nId)
    const embeddings: Record<string, number[]> = embFileId
      ? await import('@/lib/drive')
          .then((m) => m.readJSON<Record<string, number[]>>(accessToken, embFileId))
          .catch(() => ({} as Record<string, number[]>))
      : {}

    const pendientes = elegibles.filter((n) => !embeddings[n.id])
    const total = elegibles.length
    const lote = pendientes.slice(0, POR_LLAMADA)

    if (lote.length === 0) {
      return NextResponse.json({ procesadas: 0, restantes: 0, total, conEmbedding: total })
    }

    // Load content + generate embeddings for this batch
    let procesadas = 0
    for (const nota of lote) {
      try {
        const entrada = nota as typeof nota & { contenido?: string }
        const contenidoData = await leerContenido(accessToken, notasId, nota.id, entrada)
        const texto = `${nota.titulo} ${contenidoData.contenido}`.trim()
        if (!texto) continue
        const emb = await generarEmbeddingTexto(texto, accessToken)
        embeddings[nota.id] = emb
        procesadas++
      } catch {
        // skip this note if embedding fails — it'll be retried next call
      }
    }

    // Write updated embeddings file once (one Drive write for the whole batch)
    if (procesadas > 0) {
      await writeJSON(accessToken, nId, EMB_FILE, embeddings)
    }

    const restantes = Math.max(0, pendientes.length - lote.length)
    const conEmbedding = Object.keys(embeddings).length

    return NextResponse.json({ procesadas, restantes, total, conEmbedding })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
