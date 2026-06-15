import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, leerContenido, escribirIndice } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MAX_NOTAS = 8

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json().catch(() => ({}))
    const offset = (body.offset ?? 0) as number

    // Load lean index (one file) instead of all content files
    const { notasId, indice } = await leerIndice(accessToken)

    const candidatasLeanas = indice
      .filter((n) => n.tipo !== 'efimera' && (n.vinculos ?? []).length === 0)
      .slice(offset, offset + MAX_NOTAS)

    if (candidatasLeanas.length === 0) {
      return NextResponse.json({ ok: true, vinculosCreados: 0, notasProcesadas: 0, restantes: 0 })
    }

    // Load content only for the 8 candidates — not all 700+ notes
    const candidatas: Nota[] = await Promise.all(
      candidatasLeanas.map(async (n) => {
        try {
          const data = await leerContenido(accessToken, notasId, n.id, { contenido: '', versiones: [] })
          return { ...n, contenido: data.contenido, versiones: data.versiones }
        } catch {
          return { ...n, contenido: '', versiones: [] }
        }
      })
    )

    // Build context array: candidates have full content; all other notes use only their title
    const candidataIds = new Set(candidatas.map((n) => n.id))
    const todasParaContexto: Nota[] = indice.map((n) => {
      const completa = candidataIds.has(n.id) ? candidatas.find((c) => c.id === n.id) : undefined
      return completa ?? { ...n, contenido: '', versiones: [] }
    })

    let vinculosCreados = 0
    const idxMap = new Map(indice.map((n, i) => [n.id, i]))
    const ahora = new Date().toISOString()

    for (const nota of candidatas) {
      try {
        const sugerencias = await generateWithRotation(accessToken, (genAI) =>
          sugerirVinculos(nota, todasParaContexto, genAI)
        )
        const altasYMedias = sugerencias.filter((s) => s.confianza !== 'baja')
        if (altasYMedias.length === 0) continue

        const nuevosVinculos: VinculoZettel[] = altasYMedias.map((s) => ({
          notaDestinoId: s.notaId,
          tipo: s.tipoVinculo,
          nota: s.razon,
          bidireccional: false,
          creadoEn: ahora,
        }))

        const idx = idxMap.get(nota.id)
        if (idx !== undefined) {
          indice[idx] = { ...indice[idx], vinculos: nuevosVinculos, actualizadaEn: ahora }
          vinculosCreados += nuevosVinculos.length
        }
      } catch { /* si una nota falla, continuar con las demás */ }
    }

    await escribirIndice(accessToken, notasId, indice)

    const totalSinVinculos = indice.filter(
      (n) => n.tipo !== 'efimera' && (n.vinculos ?? []).length === 0
    ).length

    return NextResponse.json({
      ok: true,
      vinculosCreados,
      notasProcesadas: candidatas.length,
      restantes: totalSinVinculos,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
