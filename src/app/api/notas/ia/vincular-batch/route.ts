import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { getGeminiClient } from '@/lib/gemini'
import { sugerirVinculosBatch } from '@/lib/zettel-ia'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const NOMBRE = 'notas.json'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { soloSinVinculos } = await req.json() as { soloSinVinculos?: boolean }

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
    if (!fileId) return NextResponse.json({ aplicados: 0, conexiones: 0, notas: 0 })

    let lista: Nota[] = []
    try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }

    // Siempre mandamos TODAS las notas no-efímeras al análisis para que la IA
    // pueda encontrar conexiones entre cualquier par, incluso si una ya tiene vínculos.
    const paraAnalizar = lista.filter((n) => n.tipo !== 'efimera')
    if (paraAnalizar.length < 2) return NextResponse.json({ aplicados: 0, conexiones: 0, notas: paraAnalizar.length })

    const genAI = await getGeminiClient(accessToken)
    const conexiones = await sugerirVinculosBatch(paraAnalizar, genAI)

    if (conexiones.length === 0) return NextResponse.json({ aplicados: 0, conexiones: 0, notas: paraAnalizar.length })

    const ahora = new Date().toISOString()
    let aplicados = 0

    for (const c of conexiones) {
      const idx1 = lista.findIndex((n) => n.id === c.nota1Id)
      const idx2 = lista.findIndex((n) => n.id === c.nota2Id)
      if (idx1 === -1 || idx2 === -1) continue

      // Saltear si soloSinVinculos y ambas ya tienen vínculos
      if (soloSinVinculos) {
        const n1SinVinc = (lista[idx1].vinculos ?? []).length === 0
        const n2SinVinc = (lista[idx2].vinculos ?? []).length === 0
        if (!n1SinVinc && !n2SinVinc) continue
      }

      const ya1 = (lista[idx1].vinculos ?? []).some((v) => v.notaDestinoId === c.nota2Id)
      const ya2 = (lista[idx2].vinculos ?? []).some((v) => v.notaDestinoId === c.nota1Id)

      const vinculo: VinculoZettel = {
        notaDestinoId: '',
        tipo: c.tipo,
        nota: c.razon,
        bidireccional: true,
        creadoEn: ahora,
      }

      if (!ya1) {
        lista[idx1].vinculos = [
          ...(lista[idx1].vinculos ?? []),
          { ...vinculo, notaDestinoId: c.nota2Id },
        ]
        aplicados++
      }
      if (!ya2) {
        lista[idx2].vinculos = [
          ...(lista[idx2].vinculos ?? []),
          { ...vinculo, notaDestinoId: c.nota1Id },
        ]
        aplicados++
      }
    }

    if (aplicados > 0) {
      await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
    }

    return NextResponse.json({ aplicados, conexiones: conexiones.length, notas: paraAnalizar.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
