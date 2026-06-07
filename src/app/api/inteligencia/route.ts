import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, findFile, readJSON } from '@/lib/drive'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { Cita, FichaLectura } from '@/types'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    const indexados = documentos.filter((d) => d.estado === 'indexado')

    // Author frequency
    const autorFrecuencia = new Map<string, number>()
    for (const doc of documentos) {
      if (!doc.autor) continue
      const apellido = doc.autor.split(',')[0].trim()
      autorFrecuencia.set(apellido, (autorFrecuencia.get(apellido) ?? 0) + 1)
    }
    const autoresMasCitados = [...autorFrecuencia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))

    // Concept frequency from fichas
    const conceptoFrecuencia = new Map<string, number>()
    for (const doc of indexados) {
      try {
        const fichaFileId = await findFile(accessToken, `ficha_${doc.id}.json`, estructura.notasId)
        if (!fichaFileId) continue
        const ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)
        for (const ck of ficha.conceptosClave ?? []) {
          const c = ck.concepto.toLowerCase()
          conceptoFrecuencia.set(c, (conceptoFrecuencia.get(c) ?? 0) + 1)
        }
      } catch { /* skip */ }
    }
    const conceptosMasFrecuentes = [...conceptoFrecuencia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concepto, frecuencia]) => ({ concepto, frecuencia }))

    // Stats
    const stats = {
      totalDocumentos: documentos.length,
      documentosIndexados: indexados.length,
      fichasGeneradas: 0, // computed below
      totalFragmentos: indexados.reduce((s, d) => s + d.fragmentos, 0),
    }

    // Citations count
    let totalCitas = 0
    const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    if (citasFileId) {
      try {
        const citas = await readJSON<Cita[]>(accessToken, citasFileId)
        totalCitas = citas.length
      } catch { /* empty */ }
    }

    // Count fichas
    let fichasCount = 0
    for (const doc of indexados) {
      const fid = await findFile(accessToken, `ficha_${doc.id}.json`, estructura.notasId)
      if (fid) fichasCount++
    }
    stats.fichasGeneradas = fichasCount

    // Generate daily question with AI
    let preguntaDiaria = ''
    let brechasDetectadas: string[] = []
    if (indexados.length >= 2) {
      try {
        const genAI = await getGeminiClient(accessToken)
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })

        const listaTextos = documentos
          .map((d) => `- "${d.nombre.replace(/\.pdf$/i, '')}" por ${d.autor || '?'} (${d.año || 's.f.'})`)
          .join('\n')

        const result = await model.generateContent(
          `Analizá esta biblioteca académica de ciencias sociales latinoamericanas:\n${listaTextos}\n\n` +
          `Respondé con JSON puro (sin markdown):\n{"preguntaDiaria":"Una pregunta investigativa profunda que esta biblioteca podría responder","brechas":["brecha1","brecha2","brecha3"]}\n` +
          `Las brechas son temas importantes ausentes o subrepresentados.`
        )

        let txt = result.response.text().trim()
        if (txt.includes('```')) {
          txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
        }
        const parsed = JSON.parse(txt)
        preguntaDiaria = parsed.preguntaDiaria ?? ''
        brechasDetectadas = parsed.brechas ?? []
      } catch { /* AI unavailable */ }
    }

    return NextResponse.json({
      stats: { ...stats, totalCitas },
      autoresMasCitados,
      conceptosMasFrecuentes,
      preguntaDiaria,
      brechasDetectadas,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
