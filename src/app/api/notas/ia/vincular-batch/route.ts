import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, leerNota, escribirIndice } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { leerEmbeddingsNotas, seleccionarNotasDiversasMMR } from '@/lib/notas-emb'
import { sugerirVinculosBatch } from '@/lib/zettel-ia'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const BATCH_SIZE = 50  // max notes sent to Gemini per call

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { soloSinVinculos } = await req.json() as { soloSinVinculos?: boolean }

    const { notasId, indice } = await leerIndice(accessToken)

    const elegibles = indice
      .filter((n) => n.tipo !== 'efimera' && !(n as typeof n & { eliminadaEn?: string }).eliminadaEn)

    if (elegibles.length < 2) {
      return NextResponse.json({ aplicados: 0, conexiones: 0, notas: elegibles.length })
    }

    // Apply soloSinVinculos filter before selection
    const pool = soloSinVinculos
      ? elegibles.filter((n) => (n.vinculos ?? []).length === 0)
      : elegibles

    if (pool.length < 2) {
      return NextResponse.json({ aplicados: 0, conexiones: 0, notas: elegibles.length })
    }

    // ── Select BATCH_SIZE diverse notes via MMR ───────────────────────────────
    // MMR maximizes semantic diversity across the selected set, ensuring
    // connections are found across different conceptual clusters — not just
    // among notes that happen to have few links.
    const embeddings = await leerEmbeddingsNotas(accessToken)
    const seleccionadosIds = seleccionarNotasDiversasMMR(
      pool.map((n) => n.id),
      embeddings,
      BATCH_SIZE
    )

    // ── Load full content only for selected notes (parallel, batched) ─────────
    const LOAD_BATCH = 20
    const paraAnalizar: Nota[] = []
    for (let i = 0; i < seleccionadosIds.length; i += LOAD_BATCH) {
      const lote = seleccionadosIds.slice(i, i + LOAD_BATCH)
      const resultados = await Promise.allSettled(lote.map((id) => leerNota(accessToken, id)))
      paraAnalizar.push(
        ...resultados
          .filter((r): r is PromiseFulfilledResult<Nota> => r.status === 'fulfilled' && r.value !== null)
          .map((r) => r.value!)
      )
    }

    if (paraAnalizar.length < 2) {
      return NextResponse.json({ aplicados: 0, conexiones: 0, notas: elegibles.length })
    }

    const conexiones = await generateWithRotation(accessToken, (genAI) =>
      sugerirVinculosBatch(paraAnalizar, genAI)
    )
    if (conexiones.length === 0) {
      return NextResponse.json({ aplicados: 0, conexiones: 0, notas: elegibles.length })
    }

    const ahora = new Date().toISOString()
    let aplicados = 0

    for (const c of conexiones) {
      const idx1 = indice.findIndex((n) => n.id === c.nota1Id)
      const idx2 = indice.findIndex((n) => n.id === c.nota2Id)
      if (idx1 === -1 || idx2 === -1) continue

      const ya1 = (indice[idx1].vinculos ?? []).some((v) => v.notaDestinoId === c.nota2Id)
      const ya2 = (indice[idx2].vinculos ?? []).some((v) => v.notaDestinoId === c.nota1Id)

      const vinculo: VinculoZettel = {
        notaDestinoId: '',
        tipo: c.tipo,
        nota: c.razon,
        bidireccional: true,
        creadoEn: ahora,
      }

      if (!ya1) {
        indice[idx1] = {
          ...indice[idx1],
          vinculos: [...(indice[idx1].vinculos ?? []), { ...vinculo, notaDestinoId: c.nota2Id }],
        }
        aplicados++
      }
      if (!ya2) {
        indice[idx2] = {
          ...indice[idx2],
          vinculos: [...(indice[idx2].vinculos ?? []), { ...vinculo, notaDestinoId: c.nota1Id }],
        }
        aplicados++
      }
    }

    if (aplicados > 0) {
      await escribirIndice(accessToken, notasId, indice)
    }

    return NextResponse.json({ aplicados, conexiones: conexiones.length, notas: elegibles.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
