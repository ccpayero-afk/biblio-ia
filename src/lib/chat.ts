import { FragmentoConDocumento } from './search'
import { streamWithRotation } from './gemini'
import { GEMINI_MODEL_GENERATION } from './gemini'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SISTEMA = `Sos un asistente de investigación académica especializado en ciencias sociales latinoamericanas.
Respondés preguntas basándote ÚNICAMENTE en los fragmentos de texto que te proveo.
Cada afirmación debe citar explícitamente su fuente con el formato: (Autor, Año, p. N).
Si la información necesaria no está en los fragmentos, decís explícitamente: "No tengo esa información en la biblioteca."
No inventás datos ni generalizás más allá de lo que dicen los textos.
Respondés en español académico, con precisión conceptual.
No usás viñetas ni listas salvo que sea estrictamente necesario; respondés en prosa.`

export interface MensajeHistorial {
  rol: 'user' | 'assistant'
  contenido: string
}

function construirContexto(fragmentos: FragmentoConDocumento[]): string {
  return fragmentos
    .map((f, i) => {
      const autor = f.autor || 'Autor desconocido'
      const año = f.año || 's.f.'
      const titulo = f.documentoNombre.replace(/\.pdf$/i, '')
      return `[Fragmento ${i + 1}] ${autor} (${año}), "${titulo}", p. ${f.pagina}:\n"${f.texto}"`
    })
    .join('\n\n')
}

export async function* askLibrary(
  query: string,
  fragmentos: FragmentoConDocumento[],
  accessToken: string,
  historial: MensajeHistorial[] = []
): AsyncGenerator<string> {
  const contexto = construirContexto(fragmentos)
  const promptConContexto = fragmentos.length
    ? `FRAGMENTOS RELEVANTES DE LA BIBLIOTECA:\n\n${contexto}\n\n---\nPREGUNTA: ${query}`
    : `No encontré fragmentos relevantes en la biblioteca para esta pregunta.\n\nPREGUNTA: ${query}`

  const history = historial.map((m) => ({
    role: m.rol === 'user' ? 'user' : 'model' as 'user' | 'model',
    parts: [{ text: m.contenido }],
  }))

  yield* streamWithRotation(accessToken, async function* (genAI: GoogleGenerativeAI) {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_GENERATION,
      systemInstruction: SISTEMA,
    })
    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(promptConContexto)
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) yield text
    }
  })
}
