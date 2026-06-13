import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'

export async function POST(req: NextRequest) {
  try {
    const { q } = await req.json()
    if (!q?.trim()) return NextResponse.json([])

    const session = await auth()
    const accessToken = getAccessToken(session)

    const resultados = await semanticSearch(q, accessToken, { topK: 20 })

    // Collapse fragments → documents (first occurrence = best rank since results are sorted)
    const seen = new Map<string, number>()
    const total = resultados.length || 1
    for (let i = 0; i < resultados.length; i++) {
      const id = resultados[i].documentoId
      if (!seen.has(id)) {
        // Score: linear rank score so first result = 1.0, last = near 0
        seen.set(id, 1 - i / total)
      }
    }

    return NextResponse.json(
      Array.from(seen.entries()).map(([documentoId, score]) => ({ documentoId, score }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
