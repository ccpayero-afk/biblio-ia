import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, escribirIndice } from '@/lib/notas'
import { generateWithRotation } from '@/lib/gemini'
import { sugerirVinculosBatch } from '@/lib/zettel-ia'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { soloSinVinculos } = await req.json() as { soloSinVinculos?: boolean }

    // Use inline contenido from the index (pre-migration notes store content there).
    // Avoids 800+ individual Drive file lookups that would time out.
    const { notasId, indice } = await leerIndice(accessToken)
    const todasCompletas: Nota[] = indice.map((n) => ({
      ...n,
      contenido: (n as unknown as { contenido?: string }).contenido ?? '',
      versiones: [],
    })) as Nota[]
    const paraAnalizar = todasCompletas.filter((n) => n.tipo !== 'efimera')
    if (paraAnalizar.length < 2) return NextResponse.json({ aplicados: 0, conexiones: 0, notas: paraAnalizar.length })

    const conexiones = await generateWithRotation(accessToken, (genAI) =>
      sugerirVinculosBatch(paraAnalizar, genAI)
    )
    if (conexiones.length === 0) return NextResponse.json({ aplicados: 0, conexiones: 0, notas: paraAnalizar.length })

    const ahora = new Date().toISOString()
    let aplicados = 0

    for (const c of conexiones) {
      const idx1 = indice.findIndex((n) => n.id === c.nota1Id)
      const idx2 = indice.findIndex((n) => n.id === c.nota2Id)
      if (idx1 === -1 || idx2 === -1) continue

      if (soloSinVinculos) {
        const n1SinVinc = (indice[idx1].vinculos ?? []).length === 0
        const n2SinVinc = (indice[idx2].vinculos ?? []).length === 0
        if (!n1SinVinc && !n2SinVinc) continue
      }

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
        indice[idx1] = { ...indice[idx1], vinculos: [...(indice[idx1].vinculos ?? []), { ...vinculo, notaDestinoId: c.nota2Id }] }
        aplicados++
      }
      if (!ya2) {
        indice[idx2] = { ...indice[idx2], vinculos: [...(indice[idx2].vinculos ?? []), { ...vinculo, notaDestinoId: c.nota1Id }] }
        aplicados++
      }
    }

    if (aplicados > 0) {
      await escribirIndice(accessToken, notasId, indice)
    }

    return NextResponse.json({ aplicados, conexiones: conexiones.length, notas: paraAnalizar.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
