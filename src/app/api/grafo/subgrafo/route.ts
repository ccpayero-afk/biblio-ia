import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { Grafo, NodoGrafo, AristaGrafo } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

function extraerSubgrafo(grafo: Grafo, nodoId: string, grados: number): Grafo {
  const nodoSet = new Set<string>([nodoId])
  const frontera = new Set<string>([nodoId])

  for (let g = 0; g < grados; g++) {
    const siguiente = new Set<string>()
    for (const arista of grafo.aristas) {
      if (frontera.has(arista.source) && !nodoSet.has(arista.target)) {
        siguiente.add(arista.target)
      }
      if (frontera.has(arista.target) && !nodoSet.has(arista.source)) {
        siguiente.add(arista.source)
      }
    }
    for (const id of siguiente) nodoSet.add(id)
    frontera.clear()
    for (const id of siguiente) frontera.add(id)
  }

  const nodos: NodoGrafo[] = grafo.nodos.filter((n) => nodoSet.has(n.id))
  const aristas: AristaGrafo[] = grafo.aristas.filter(
    (a) => nodoSet.has(a.source) && nodoSet.has(a.target)
  )

  return { nodos, aristas, actualizadoEn: grafo.actualizadoEn }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const nodoId = req.nextUrl.searchParams.get('nodoId')
    const grados = Math.min(parseInt(req.nextUrl.searchParams.get('grados') ?? '2', 10), 4)

    if (!nodoId) {
      return NextResponse.json({ error: 'nodoId requerido' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'grafo.json', estructura.conceptosId)
    if (!fileId) {
      return NextResponse.json({ error: 'Grafo no encontrado — generalo primero' }, { status: 404 })
    }

    const grafo = await readJSON<Grafo>(accessToken, fileId)
    const subgrafo = extraerSubgrafo(grafo, nodoId, grados)
    return NextResponse.json(subgrafo)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
