import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, leerNota } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import {
  leerEmbeddingsNotas,
  generarEmbeddingTexto,
  ranquearNotasPorSimilitud,
} from '@/lib/notas-emb'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const CANDIDATAS_MAX = 20  // number of candidates loaded with full content
const KEYWORD_FALLBACK_MAX = 20

// POST — body: { nota } — devuelve sugerencias de vínculos IA
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { nota } = await req.json() as { nota: Nota }

    const { notasId, indice } = await leerIndice(accessToken)

    const elegibles = indice.filter(
      (n) => n.id !== nota.id && n.tipo !== 'efimera' && !(n as typeof n & { eliminadaEn?: string }).eliminadaEn
    )
    if (elegibles.length === 0) return NextResponse.json([])

    // ── Semantic pre-filter ───────────────────────────────────────────────────
    let candidatosIds: string[] | null = null

    const embeddings = await leerEmbeddingsNotas(accessToken)
    const embCount = Object.keys(embeddings).length

    if (embCount >= 5) {
      const notaTexto = `${nota.titulo} ${nota.contenido}`.slice(0, 2000)
      let notaEmb: number[] | null = embeddings[nota.id] ?? null

      if (!notaEmb) {
        notaEmb = await generarEmbeddingTexto(notaTexto, accessToken).catch(() => null)
      }

      if (notaEmb) {
        const ranqueadas = ranquearNotasPorSimilitud(notaEmb, elegibles.map((n) => n.id), embeddings)
        candidatosIds = ranqueadas.slice(0, CANDIDATAS_MAX).map((r) => r.id)
      }
    }

    // ── Keyword fallback (uses only index — no extra Drive calls) ─────────────
    if (!candidatosIds) {
      const palabrasRef = new Set(
        `${nota.titulo} ${nota.contenido}`.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
      )
      const scored = elegibles
        .map((n) => {
          const haystack = `${n.titulo} ${(n.etiquetas ?? []).join(' ')}`.toLowerCase()
          const score = [...palabrasRef].filter((p) => haystack.includes(p)).length
          return { id: n.id, score }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, KEYWORD_FALLBACK_MAX)
      candidatosIds = scored.map((x) => x.id)
      if (candidatosIds.length === 0) {
        candidatosIds = elegibles.slice(0, 10).map((n) => n.id)
      }
    }

    // ── Load full content only for selected candidates ─────────────────────
    const resultados = await Promise.allSettled(
      candidatosIds.map((id) => leerNota(accessToken, id))
    )
    const candidatas = resultados
      .filter((r): r is PromiseFulfilledResult<Nota> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value!)

    if (candidatas.length === 0) return NextResponse.json([])

    const sugerencias = await generateWithRotation(accessToken, (genAI) =>
      sugerirVinculos(nota, candidatas, genAI)
    )
    return NextResponse.json(sugerencias)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
