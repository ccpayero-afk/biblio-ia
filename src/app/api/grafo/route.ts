import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { buildGrafo } from '@/lib/grafo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const rebuild = req.nextUrl.searchParams.get('rebuild') === '1'

    // Try cached unless rebuild requested
    if (!rebuild) {
      try {
        const { initUserDrive, findFile, readJSON } = await import('@/lib/drive')
        const estructura = await initUserDrive(accessToken)
        const fileId = await findFile(accessToken, 'grafo.json', estructura.conceptosId)
        if (fileId) {
          const grafo = await readJSON<{ nodos?: unknown[] }>(accessToken, fileId)
          // Skip empty cache — always rebuild if no nodes
          if (grafo?.nodos && grafo.nodos.length > 0) return NextResponse.json(grafo)
        }
      } catch { /* build fresh */ }
    }

    const grafo = await buildGrafo(accessToken)
    return NextResponse.json(grafo)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
