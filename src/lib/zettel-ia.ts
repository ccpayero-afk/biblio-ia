import { GoogleGenerativeAI } from '@google/generative-ai'
import { Nota, VinculoSugerido, VinculoZettel } from '@/types'
import { GEMINI_MODEL_GENERATION } from './gemini'

export async function sugerirVinculos(
  notaNueva: Nota,
  todasLasNotas: Nota[],
  genAI: GoogleGenerativeAI
): Promise<VinculoSugerido[]> {
  const elegibles = todasLasNotas
    .filter((n) => n.id !== notaNueva.id && n.tipo !== 'efimera')

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
    .map((n) => `ID: ${n.id}\nTítulo: ${n.titulo}\nContenido: ${n.contenido.slice(0, 250)}`)
    .join('\n---\n')

  const prompt = `Sos un asistente de investigación académica especializado en ciencias sociales latinoamericanas.
Te doy una nota de un Zettelkasten y una lista de notas existentes.

Identificá TODAS las notas que se relacionan conceptualmente con la nota dada, aunque sea de forma indirecta.
Para cada relación, indicá el tipo:
- complementa: las ideas se refuerzan mutuamente
- contradice: las ideas están en tensión o conflicto
- ejemplifica: una nota da un ejemplo concreto de la idea de la otra
- aplica_en: una idea abstracta se aplica en el caso de la otra
- es_consecuencia_de: una idea se desprende lógicamente de la otra
- cuestiona: una nota abre preguntas que la otra no responde
- define: una nota define un concepto que la otra usa
- ver_tambien: cualquier relación relevante

Importante: devolvé TODAS las relaciones que encuentres, sean fuertes o débiles. Usá "confianza" para indicar qué tan segura es la relación (alta/media/baja), pero no omitas ninguna.
Respondé ÚNICAMENTE en JSON válido sin texto adicional:
{ "sugerencias": [{ "notaId": "...", "tipoVinculo": "...", "razon": "...", "confianza": "alta|media|baja" }] }

Nota a analizar:
Título: ${notaNueva.titulo}
Contenido: ${notaNueva.contenido.slice(0, 600)}

Notas existentes:
${listaNotas}`

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  const text = result.response.text().trim()

  // Handle plain JSON or markdown code block: ```json {...} ```
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.sugerencias ?? [])
    .map((s: { notaId: string; tipoVinculo: VinculoZettel['tipo']; razon: string; confianza: 'alta' | 'media' | 'baja' }) => {
      const notaRef = candidatas.find((n) => n.id === s.notaId)
      return {
        notaId: s.notaId,
        notaTitulo: notaRef?.titulo ?? s.notaId,
        tipoVinculo: s.tipoVinculo,
        razon: s.razon,
        confianza: s.confianza,
      }
    })
    .filter((s: { notaId: string }) => s.notaId && candidatas.some((n) => n.id === s.notaId))
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
  const prompt = `[Contexto de investigación]
Estoy construyendo un Zettelkasten académico en ciencias sociales latinoamericanas. Trabajo con fuentes teóricas y empíricas, y mi objetivo es construir pensamiento propio a partir de la literatura.

[Tu rol]
Sos un asistente de investigación especializado en ciencias sociales. Tu tarea es ayudarme a transformar una nota efímera (captura rápida de lectura) en una nota permanente Zettelkasten de alta calidad.

[Criterios para la nota permanente]
1. Formula UNA SOLA idea como afirmación propia del investigador
2. Primera persona reflexiva: "Considero que...", "Interpreto que...", "La tensión entre X e Y..."
3. Es autónoma: se entiende sin leer la fuente original
4. Establece conexiones explícitas con otras ideas (aunque sean hipotéticas)
5. Identifica la tensión teórica o empírica que resuelve o abre
6. Usa lenguaje académico preciso pero fluido
7. Máximo 4 párrafos de desarrollo
8. El título es una AFIRMACIÓN, no un tema

[Estructura del output]
Respondé ÚNICAMENTE con el siguiente formato markdown, sin texto adicional antes ni después:

# Título
[Título como afirmación]

# Idea principal
[Un párrafo de 2-3 oraciones que formula la idea atómica]

# Importancia teórica
[Por qué esta idea importa en el debate académico]

# Reflexión analítica
[Tu lectura crítica: tensiones, matices, lo que esta idea abre o cierra]

# Posibles conexiones
- [[concepto o autor]]
- [[concepto o autor]]
(al menos 3)

# Aplicación para investigación
[Cómo usarías esta idea en tu propia investigación]

# Referencia
[Autor, año, p. X]

Nota efímera a transformar:
${contenidoEfimero.slice(0, 1500)}`

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
  const result = await model.generateContent(prompt)
  const contenido = result.response.text().trim()

  const tituloMatch = contenido.match(/^#\s*Título\s*\n+(.+)/m)
  const titulo_sugerido = tituloMatch ? tituloMatch[1].trim() : 'Nota permanente'

  const conexionesMatch = contenido.match(/# Posibles conexiones([\s\S]*?)(?=\n#|$)/)
  const etiquetas_sugeridas = conexionesMatch
    ? [...conexionesMatch[1].matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1].toLowerCase().replace(/\s+/g, '-'))
    : []

  return {
    titulo_sugerido,
    contenido_sugerido: contenido,
    tipo_sugerido: 'permanente',
    etiquetas_sugeridas,
    razon_titulo: 'Generado con método Zettelkasten',
  }
}
