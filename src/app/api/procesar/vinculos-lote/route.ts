import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { generateWithRotation } from '@/lib/gemini'
import { sugerirVinculos } from '@/lib/zettel-ia'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MAX_NOTAS = 8  // 8 notas × ~5s cada una = ~40s, seguro dentro de los 60s de Vercel

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json().catch(() => ({}))
    const offset = (body.offset ?? 0) as number  // para paginación desde el cliente

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    if (!fileId) return NextResponse.json({ ok: true, vinculosCreados: 0, notasProcesadas: 0, restantes: 0 })

    let notas = await readJSON<Nota[]>(accessToken, fileId)

    // Notas candidatas: referencia, sin vínculos todavía, auto-ficha
    const candidatas = notas
      .filter((n) => n.tipo === 'referencia' && (n.vinculos ?? []).length === 0)
      .slice(offset, offset + MAX_NOTAS)

    if (candidatas.length === 0) {
      return NextResponse.json({ ok: true, vinculosCreados: 0, notasProcesadas: 0, restantes: 0 })
    }

    let vinculosCreados = 0

    // Mapa id → índice para acceso rápido
    const idxMap = new Map(notas.map((n, i) => [n.id, i]))

    for (const nota of candidatas) {
      try {
        const sugerencias = await generateWithRotation(accessToken, (genAI) => sugerirVinculos(nota, notas, genAI))
        const altasYMedias = sugerencias.filter((s) => s.confianza !== 'baja')

        if (altasYMedias.length === 0) continue

        const ahora = new Date().toISOString()
        const nuevosVinculos: VinculoZettel[] = altasYMedias.map((s) => ({
          notaDestinoId: s.notaId,
          tipo: s.tipoVinculo,
          nota: s.razon,
          bidireccional: false,
          creadoEn: ahora,
        }))

        // Actualizar la nota en memoria
        const idx = idxMap.get(nota.id)
        if (idx !== undefined) {
          notas[idx] = { ...notas[idx], vinculos: nuevosVinculos, actualizadaEn: ahora }
          vinculosCreados += nuevosVinculos.length
        }
      } catch { /* si una nota falla, continuar con las demás */ }
    }

    // Guardar todas las notas en un solo write
    await writeJSON(accessToken, estructura.notasId, 'notas.json', notas)

    // Calcular cuántas quedan sin procesar
    const totalSinVinculos = notas.filter(
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
