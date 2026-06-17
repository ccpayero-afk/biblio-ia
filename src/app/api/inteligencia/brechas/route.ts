export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, findFile, readJSON, writeJSON } from '@/lib/drive'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { NextResponse } from 'next/server'

// Cache brechas for 24h to avoid Gemini calls on every Aula load
const CACHE_FILE = 'brechas_cache.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface BreachasCache {
  brechas: string[]
  generadoEn: string
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    // Try cache first
    const cacheId = await findFile(accessToken, CACHE_FILE, estructura.notasId)
    if (cacheId) {
      try {
        const cache = await readJSON<BreachasCache>(accessToken, cacheId)
        if (Date.now() - new Date(cache.generadoEn).getTime() < CACHE_TTL_MS) {
          return NextResponse.json({ brechas: cache.brechas, fromCache: true })
        }
      } catch { /* regenerate */ }
    }

    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    if (documentos.length < 2) {
      return NextResponse.json({ brechas: [] })
    }

    const listaTextos = documentos
      .map((d) => `- "${d.nombre.replace(/\.pdf$/i, '')}" por ${d.autor || '?'} (${d.año || 's.f.'})`)
      .join('\n')

    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent(
        `Analizá esta biblioteca académica:\n${listaTextos}\n\n` +
        `Respondé con JSON puro (sin markdown):\n{"brechas":["brecha1","brecha2","brecha3"]}\n` +
        `Las brechas son temas o perspectivas importantes ausentes o subrepresentados. Máx 4 brechas, concisas (1 oración c/u).`
      )
    })

    let txt = result.response.text().trim()
    if (txt.includes('```')) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
    const parsed = JSON.parse(txt)
    const brechas: string[] = parsed.brechas ?? []

    const cache: BreachasCache = { brechas, generadoEn: new Date().toISOString() }
    await writeJSON(accessToken, estructura.notasId, CACHE_FILE, cache)

    return NextResponse.json({ brechas })
  } catch (e) {
    return NextResponse.json({ brechas: [], error: String(e) })
  }
}
