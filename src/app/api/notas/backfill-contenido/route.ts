import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, leerContenido, escribirIndice, NotaLigera } from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST { offset?, limit? }
// Para cada nota del índice que NO tiene contenido inline, lee su archivo en Drive
// y lo agrega al índice. Ejecutar en loop desde el cliente hasta restantes === 0.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json().catch(() => ({}))
    const offset: number = body.offset ?? 0
    const limit: number = body.limit ?? 50

    const { notasId, indice } = await leerIndice(accessToken)

    type EntradaConContenido = NotaLigera & { contenido?: string; eliminadaEn?: string }
    const sinContenido = (indice as EntradaConContenido[])
      .map((n, originalIdx) => ({ n, originalIdx }))
      .filter(({ n }) => !n.contenido && !(n as EntradaConContenido).eliminadaEn)

    const total = sinContenido.length
    const lote = sinContenido.slice(offset, offset + limit)

    if (lote.length === 0) {
      return NextResponse.json({ actualizado: 0, restantes: 0, total })
    }

    // Leer archivos de contenido en paralelo (batch de 10)
    const BATCH = 10
    let actualizado = 0
    for (let i = 0; i < lote.length; i += BATCH) {
      const sub = lote.slice(i, i + BATCH)
      await Promise.all(
        sub.map(async ({ n, originalIdx }) => {
          const entry = n as EntradaConContenido
          try {
            const data = await leerContenido(accessToken, notasId, n.id, entry)
            if (data.contenido) {
              indice[originalIdx] = { ...indice[originalIdx], contenido: data.contenido } as unknown as NotaLigera
              actualizado++
            }
          } catch { /* archivo no encontrado — dejar sin contenido */ }
        })
      )
    }

    if (actualizado > 0) {
      await escribirIndice(accessToken, notasId, indice)
    }

    const restantes = Math.max(0, total - offset - lote.length)
    return NextResponse.json({ actualizado, restantes, total, offset })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
