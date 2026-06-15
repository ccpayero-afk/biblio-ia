import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerTodasCompletas, leerIndice, escribirIndice } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MAX_NOTAS = 8

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json().catch(() => ({}))
    const offset = (body.offset ?? 0) as number

    // Load full notes for AI context, lean index for vinculos updates
    const [todasCompletas, { notasId, indice }] = await Promise.all([
      leerTodasCompletas(accessToken),
      leerIndice(accessToken),
    ])

    const candidatas = todasCompletas
      .filter((n) => n.tipo === 'referencia' && (n.vinculos ?? []).length === 0)
      .slice(offset, offset + MAX_NOTAS)

    if (candidatas.length === 0) {
      return NextResponse.json({ ok: true, vinculosCreados: 0, notasProcesadas: 0, restantes: 0 })
    }

    let vinculosCreados = 0
    const idxMap = new Map(indice.map((n, i) => [n.id, i]))
    const ahora = new Date().toISOString()

    for (const nota of candidatas) {
      try {
        const sugerencias = await generateWithRotation(accessToken, (genAI) =>
          sugerirVinculos(nota, todasCompletas, genAI)
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
      (n) => n.tipo === 'referencia' && (n.vinculos ?? []).length === 0
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
