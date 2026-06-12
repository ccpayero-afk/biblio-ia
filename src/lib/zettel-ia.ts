import { GoogleGenerativeAI } from '@google/generative-ai'
import { Nota, VinculoSugerido, VinculoZettel } from '@/types'
import { GEMINI_MODEL_GENERATION } from './gemini'

export async function sugerirVinculos(
  notaNueva: Nota,
  todasLasNotas: Nota[],
  genAI: GoogleGenerativeAI
): Promise<VinculoSugerido[]> {
  const elegibles = todasLasNotas
    .filter((n) => n.id !== notaNueva.id && n.tipo !== 'efimera' && n.tipo !== 'manual')

  if (elegibles.length === 0) return []

  // Pre-filtrar por relevancia de keywords para reducir tokens enviados a la IA.
  // Extraemos palabras significativas (>4 chars) del título + contenido de la nota nueva.
  const palabrasRef = new Set(
    `${notaNueva.titulo} ${notaNueva.contenido}`
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
  )

  const scored = elegibles.map((n) => {
    const texto = `${n.titulo} ${n.contenido}`.toLowerCase()
    const matches = [...palabrasRef].filter((p) => texto.includes(p)).length
    return { n, matches }
  })

  // Top 30 más relevantes por keywords; si hay menos de 5 matches, completar hasta 30 con el resto
  const candidatas = scored
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 30)
    .map((s) => s.n)

  const listaNotas = candidatas
    .map((n) => `ID: ${n.id}\nTítulo: ${n.titulo}\nContenido: ${n.contenido.slice(0, 150)}`)
    .join('\n---\n')

  const prompt = `Sos un asistente de investigación académica especializado en ciencias sociales latinoamericanas.
Te doy una nota nueva y una lista de notas existentes en el Zettelkasten del usuario.

Tu tarea es identificar qué notas existentes se relacionan conceptualmente con la nota nueva,
y qué TIPO de relación existe entre ellas:
- complementa: las dos notas se refuerzan mutuamente
- contradice: las ideas de las notas están en tensión
- ejemplifica: una nota da un ejemplo concreto de la idea de la otra
- aplica_en: la idea abstracta de una nota se aplica en el caso de la otra
- es_consecuencia_de: una idea se desprende lógicamente de la otra
- cuestiona: una nota abre preguntas que la otra no responde
- define: una nota define un concepto que la otra usa
- ver_tambien: relación relevante sin tipo específico claro

Devolvé SOLO las relaciones con confianza alta o media. No fuerces vínculos débiles.
Respondé ÚNICAMENTE en JSON válido sin texto adicional:
{ "sugerencias": [{ "notaId": "...", "tipoVinculo": "...", "razon": "...", "confianza": "alta|media|baja" }] }

Nota nueva:
Título: ${notaNueva.titulo}
Contenido: ${notaNueva.contenido.slice(0, 500)}

Notas existentes:
${listaNotas}`

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonStr = text.startsWith('{') ? text : text.slice(text.indexOf('{'))
    const parsed = JSON.parse(jsonStr)

    return (parsed.sugerencias ?? [])
      .filter((s: VinculoSugerido) => s.confianza !== 'baja')
      .map((s: { notaId: string; tipoVinculo: VinculoZettel['tipo']; razon: string; confianza: 'alta' | 'media' | 'baja' }) => {
        const nota = candidatas.find((n) => n.id === s.notaId)
        return {
          notaId: s.notaId,
          notaTitulo: nota?.titulo ?? s.notaId,
          tipoVinculo: s.tipoVinculo,
          razon: s.razon,
          confianza: s.confianza,
        }
      })
  } catch {
    return []
  }
}

export async function convertirNota(
  contenidoEfimero: string,
  genAI: GoogleGenerativeAI
): Promise<{
  titulo_sugerido: string
  contenido_sugerido: string
  tipo_sugerido: 'permanente' | 'estructura' | 'proyecto'
  etiquetas_sugeridas: string[]
  razon_titulo: string
}> {
  const prompt = `Sos un asistente que ayuda a transformar notas de lectura en notas permanentes de conocimiento propio.

Una nota permanente Zettelkasten:
- Formula una sola idea como afirmación propia del investigador, no como resumen del texto
- Usa primera persona: "Considero que..." / "En mi lectura de..." / "La tensión entre X e Y se resuelve si..."
- Es autónoma: se entiende sin haber leído el texto de origen
- Es breve: máximo 3 párrafos

Tomá esta nota de lectura y proponé su versión como nota permanente.
También proponé: un título como afirmación (no como tema), etiquetas relevantes, y el tipo más apropiado.

Respondé ÚNICAMENTE en JSON válido sin texto adicional:
{
  "titulo_sugerido": "...",
  "contenido_sugerido": "...",
  "tipo_sugerido": "permanente|estructura|proyecto",
  "etiquetas_sugeridas": ["..."],
  "razon_titulo": "..."
}

Nota de lectura original:
${contenidoEfimero.slice(0, 1000)}`

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const jsonStr = text.startsWith('{') ? text : text.slice(text.indexOf('{'))
  return JSON.parse(jsonStr)
}
