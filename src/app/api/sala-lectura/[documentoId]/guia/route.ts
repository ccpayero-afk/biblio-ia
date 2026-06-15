export const maxDuration = 60

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Fragmento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { documentoId } = await params

  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, `guia_${documentoId}.json`, estructura.notasId)
  if (!fileId) return NextResponse.json(null)
  const guia = await readJSON(accessToken, fileId)
  return NextResponse.json(guia)
}

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

  // Load document fragments from index
  const indexFileId = await findFile(accessToken, 'index.json', estructura.indexId)
  const todosFragmentos: Fragmento[] = indexFileId
    ? await readJSON<Fragmento[]>(accessToken, indexFileId).catch(() => [])
    : []
  const fragmentos = todosFragmentos.filter((f) => f.documentoId === documentoId)

  const N = 15
  const muestra = fragmentos.length <= N
    ? fragmentos
    : Array.from({ length: N }, (_, i) => fragmentos[Math.floor(i * (fragmentos.length - 1) / (N - 1))])
  const muestraTexto = muestra
    .map((f) => `[p.${f.pagina}] ${f.texto.slice(0, 500)}`)
    .join('\n\n')

  const titulo = (documentoNombre || documentoId).replace(/\.pdf$/i, '')

  const prompt = `Sos un asistente de investigación académica. Generá una guía de lectura para orientar la lectura crítica del siguiente texto.

DOCUMENTO: "${titulo}" — ${autor || 'Autor desconocido'} (${año || 's.f.'})

${fragmentos.length > 0
  ? `FRAGMENTOS DEL TEXTO (muestra de ${muestra.length} páginas):\n${muestraTexto}`
  : 'El texto aún no ha sido indexado. Generá la guía basándote en el título y autor únicamente.'}

Respondé ÚNICAMENTE con un objeto JSON puro (sin markdown, sin \`\`\`json):
{
  "orientacionGeneral": "En 2-3 párrafos: qué tipo de texto es, a qué tradición teórica pertenece, en qué contexto fue escrito y qué lugar ocupa en su campo",
  "preguntasGuia": [
    "¿Pregunta clave que debe responder el lector mientras lee?",
    "¿Otra pregunta orientadora?"
  ],
  "conceptosARastrear": ["concepto1", "concepto2", "concepto3"],
  "estrategiaLectura": "Cómo abordar el texto: si leer linealmente o por secciones, qué partes priorizar, qué nivel de detalle dedicar a cada parte",
  "conexionesPosibes": "Con qué otros autores, debates o textos conecta este trabajo. Qué diálogos teóricos permite abrir",
  "checklistPostLectura": [
    "¿Pude identificar la tesis central?",
    "¿Tomé nota de los conceptos clave y sus definiciones?",
    "¿Extraje al menos 3 citas relevantes?",
    "¿Identifiqué la metodología?",
    "¿Registré con qué autores dialoga?"
  ]
}`

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

  const guia = {
    documentoId,
    ...JSON.parse(text),
    generadaEn: new Date().toISOString(),
  }

  await writeJSON(accessToken, estructura.notasId, `guia_${documentoId}.json`, guia)
  return NextResponse.json(guia)
}
