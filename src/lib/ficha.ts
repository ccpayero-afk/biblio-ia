import { FichaLectura, Fragmento } from '@/types'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from './gemini'
import { initUserDrive, findFile, readJSON, writeJSON } from './drive'

export async function generateFicha(
  documentoId: string,
  documentoNombre: string,
  autor: string,
  año: string,
  fragmentos: Fragmento[],
  accessToken: string
): Promise<FichaLectura> {
  const genAI = await getGeminiClient(accessToken)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })

  const muestra = fragmentos
    .filter((f) => f.documentoId === documentoId)
    .slice(0, 25)
    .map((f) => `[p.${f.pagina}] ${f.texto}`)
    .join('\n\n')

  const titulo = documentoNombre.replace(/\.pdf$/i, '')
  const prompt = `Analizá el siguiente texto académico y generá una ficha de lectura estructurada.

DOCUMENTO: "${titulo}" por ${autor || 'Autor desconocido'} (${año || 's.f.'})

FRAGMENTOS SELECCIONADOS:
${muestra}

Respondé ÚNICAMENTE con un objeto JSON puro (sin markdown, sin \`\`\`json) con esta estructura exacta:
{
  "tesisCentral": "Una oración que sintetice la tesis principal",
  "argumentoPrincipal": "Dos o tres oraciones que expliquen el argumento central y cómo se sostiene",
  "conceptosClave": [
    { "concepto": "nombre del concepto", "definicion": "cómo lo define el autor en el texto" }
  ],
  "posicionDebate": "En qué debate académico se inscribe y qué posición adopta frente a otros autores",
  "citasDestacadas": [
    { "texto": "cita textual relevante extraída del fragmento", "pagina": 1 }
  ],
  "limitaciones": "Qué aspectos no aborda, limitaciones metodológicas o críticas posibles",
  "relevancia": "Por qué es relevante para investigación en ciencias sociales latinoamericanas"
}`

  const result = await model.generateContent(prompt)
  let text = result.response.text().trim()

  // Extract the JSON object regardless of markdown wrappers
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1)

  let parsed: {
    tesisCentral?: string
    argumentoPrincipal?: string
    conceptosClave?: { concepto: string; definicion: string }[]
    posicionDebate?: string
    citasDestacadas?: { texto: string; pagina: number }[]
    limitaciones?: string
    relevancia?: string
  }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini no devolvió JSON válido. Intentá de nuevo o verificá que el documento tiene texto indexado.')
  }

  return {
    documentoId,
    tesisCentral: parsed.tesisCentral ?? '',
    argumentoPrincipal: parsed.argumentoPrincipal ?? '',
    conceptosClave: parsed.conceptosClave ?? [],
    posicionDebate: parsed.posicionDebate ?? '',
    citasDestacadas: parsed.citasDestacadas ?? [],
    limitaciones: parsed.limitaciones ?? '',
    relevancia: parsed.relevancia ?? '',
    generadaEn: new Date().toISOString(),
  }
}

export async function getFicha(documentoId: string, accessToken: string): Promise<FichaLectura | null> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
  if (!fileId) return null
  return readJSON<FichaLectura>(accessToken, fileId)
}

export async function saveFicha(ficha: FichaLectura, accessToken: string): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  await writeJSON(accessToken, estructura.notasId, `ficha_${ficha.documentoId}.json`, ficha)
}
