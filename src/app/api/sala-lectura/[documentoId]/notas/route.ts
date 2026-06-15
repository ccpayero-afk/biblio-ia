export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { leerIndice, aLigera, escribirIndice, escribirContenido } from '@/lib/notas'
import { Nota, Fragmento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { documentoId } = await params
  const body = await req.json().catch(() => ({}))
  const { documentoNombre = '', autor = '', año = '' } = body

  const estructura = await initUserDrive(accessToken)

  const indexFileId = await findFile(accessToken, 'index.json', estructura.indexId)
  if (!indexFileId) return NextResponse.json({ error: 'Documento no indexado' }, { status: 400 })

  const todosFragmentos = await readJSON<Fragmento[]>(accessToken, indexFileId).catch(() => [] as Fragmento[])
  const fragmentos = todosFragmentos.filter((f) => f.documentoId === documentoId)
  if (fragmentos.length === 0) return NextResponse.json({ error: 'Documento no indexado' }, { status: 400 })

  const N = 12
  const muestra = fragmentos.length <= N
    ? fragmentos
    : Array.from({ length: N }, (_, i) => fragmentos[Math.floor(i * (fragmentos.length - 1) / (N - 1))])
  const muestraTexto = muestra
    .map((f) => `[p.${f.pagina}] ${f.texto.slice(0, 500)}`)
    .join('\n\n')

  const titulo = (documentoNombre || documentoId).replace(/\.pdf$/i, '')

  const prompt = `Sos un asistente de investigación especializado en Zettelkasten académico para ciencias sociales.
A partir de los fragmentos del siguiente texto, extraé entre 5 y 8 notas permanentes Zettelkasten.

TEXTO: "${titulo}" — ${autor || 'Autor desconocido'} (${año || 's.f.'})

FRAGMENTOS:
${muestraTexto}

Cada nota debe:
- Formular UNA SOLA idea en primera persona ("Considero que...", "La tensión entre X e Y...")
- Ser autónoma: entenderse sin leer la fuente
- Tener un título que sea una AFIRMACIÓN, no un tema
- Referir al texto con página cuando sea posible

Respondé ÚNICAMENTE con JSON puro (sin markdown):
{"notas":[
  {"titulo":"Afirmación que formula la idea","contenido":"2-3 párrafos que desarrollan la idea atómica","pagina":1}
]}`

  const genAI = await getGeminiClient(accessToken)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
  })
  let text = result.response.text().trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1)

  const parsed = JSON.parse(text)
  const notasNuevas: Nota[] = (parsed.notas ?? []).map((n: { titulo: string; contenido: string; pagina?: number }, i: number) => ({
    id: `nota_${Date.now()}_${i}`,
    titulo: n.titulo ?? 'Sin título',
    contenido: n.contenido ?? '',
    tipo: 'referencia' as const,
    vinculos: [],
    documentoOrigenId: documentoId,
    paginaOrigen: n.pagina,
    etiquetas: [],
    creadaEn: new Date().toISOString(),
    actualizadaEn: new Date().toISOString(),
  }))

  const { notasId, indice } = await leerIndice(accessToken)
  await Promise.all([
    ...notasNuevas.map((n) =>
      escribirContenido(accessToken, notasId, n.id, { contenido: n.contenido, versiones: [] })
    ),
    escribirIndice(accessToken, notasId, [...indice, ...notasNuevas.map(aLigera)]),
  ])

  return NextResponse.json({ creadas: notasNuevas.length, notas: notasNuevas })
}
