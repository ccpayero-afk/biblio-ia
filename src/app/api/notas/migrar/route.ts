import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { Nota } from '@/types'
import { leerIndice, aLigera, escribirIndice, escribirContenido } from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST /api/notas/migrar
// Paginado: procesa `limit` notas por llamada empezando desde `offset`.
// Llamar repetidamente hasta que restantes === 0.
// Body: { offset?: number, limit?: number }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json().catch(() => ({}))
    const offset: number = body.offset ?? 0
    const limit: number = body.limit ?? 50

    const estructura = await initUserDrive(accessToken)

    const oldFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    if (!oldFileId) return NextResponse.json({ ok: true, migradas: 0, restantes: 0, total: 0 })

    const viejas = await readJSON<Nota[]>(accessToken, oldFileId).catch(() => [] as Nota[])
    if (viejas.length === 0) return NextResponse.json({ ok: true, migradas: 0, restantes: 0, total: 0 })

    const { notasId } = await leerIndice(accessToken)

    const lote = viejas.slice(offset, offset + limit)

    // Write content files in sub-batches of 10
    const BATCH = 10
    let migradas = 0
    for (let i = 0; i < lote.length; i += BATCH) {
      const sub = lote.slice(i, i + BATCH)
      await Promise.all(
        sub.map((n) =>
          escribirContenido(accessToken, notasId, n.id, {
            contenido: n.contenido ?? '',
            versiones: n.versiones ?? [],
          })
        )
      )
      migradas += sub.length
    }

    // On the last batch, also rewrite the lean index
    const restantes = Math.max(0, viejas.length - offset - migradas)
    if (restantes === 0) {
      const { indice } = await leerIndice(accessToken)
      const viejasIds = new Set(viejas.map((n) => n.id))
      const extras = indice.filter((n) => !viejasIds.has(n.id))
      await escribirIndice(accessToken, notasId, [...viejas.map(aLigera), ...extras])
    }

    return NextResponse.json({ ok: true, migradas, offset, restantes, total: viejas.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
