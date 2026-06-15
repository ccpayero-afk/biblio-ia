import { GoogleGenerativeAI } from '@google/generative-ai'
import { Nota, VinculoSugerido, VinculoZettel } from '@/types'
import { GEMINI_MODEL_PIPELINE } from './gemini'

export async function sugerirVinculosBatch(
  notas: Nota[],
  genAI: GoogleGenerativeAI
): Promise<Array<{ nota1Id: string; nota2Id: string; tipo: VinculoZettel['tipo']; razon: string }>> {
  // Ordenar: primero las que tienen menos vinculos (más necesitadas)
  const elegibles = notas
    .filter((n) => n.tipo !== 'efimera')
    .sort((a, b) => (a.vinculos ?? []).length - (b.vinculos ?? []).length)
    .slice(0, 50)  // máx 50 notas por batch para no exceder el timeout de Vercel

  if (elegibles.length < 2) return []

  const maxConexiones = Math.min(30, elegibles.length)

  const listado = elegibles
    .map((n) => `[${n.id}] ${n.titulo}\n  ${n.contenido.slice(0, 60).replace(/\n/g, ' ')}`)
    .join('\n')

  const prompt = `Analizá estas notas de un Zettelkasten académico en ciencias sociales.
Encontrá hasta ${maxConexiones} conexiones conceptuales significativas entre ellas.
Solo conexiones con relación concreta y real. Si hay dudas, omitir.

Tipos: complementa, contradice, ejemplifica, aplica_en, es_consecuencia_de, cuestiona, define, ver_tambien

Respondé SOLO con JSON válido, sin texto antes ni después:
{"conexiones":[{"nota1Id":"...","nota2Id":"...","tipo":"...","razon":"una oración breve"}]}

NOTAS:
${listado}`

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_PIPELINE })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
  })
  const text = result.response.text().trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  const idSet = new Set(elegibles.map((n) => n.id))

  return (parsed.conexiones ?? [])
    .filter((c: { nota1Id: string; nota2Id: string }) =>
      idSet.has(c.nota1Id) && idSet.has(c.nota2Id) && c.nota1Id !== c.nota2Id
    )
    .slice(0, maxConexiones)
}

export async function sugerirVinculos(
  notaNueva: Nota,
  todasLasNotas: Nota[],
  genAI: GoogleGenerativeAI
): Promise<VinculoSugerido[]> {
  const elegibles = todasLasNotas.filter((n) => n.id !== notaNueva.id && n.tipo !== 'efimera')
  if (elegibles.length === 0) return []

  const palabrasRef = new Set(
    `${notaNueva.titulo} ${notaNueva.contenido}`
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
  )

  // Ordenar por keyword overlap; incluir todas (0 matches también) como fallback conceptual
  const candidatas = elegibles
    .map((n) => {
      const texto = `${n.titulo} ${n.contenido}`.toLowerCase()
      const matches = [...palabrasRef].filter((p) => texto.includes(p)).length
      return { n, matches }
    })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 10)
    .map((s) => s.n)

  const listaCandidatas = candidatas
    .map((n) => `[${n.id}] ${n.titulo} — ${n.contenido.slice(0, 60)}`)
    .join('\n')

  const prompt = `Encontrá los vínculos más relevantes (máximo 5) entre la nota y las candidatas.
Solo incluí vínculos con conexión conceptual real y concreta. Menos vínculos pero más precisos.

Tipos: complementa, contradice, ejemplifica, aplica_en, es_consecuencia_de, cuestiona, define, ver_tambien

JSON sin texto adicional:
{"sugerencias":[{"notaId":"...","tipoVinculo":"...","razon":"una oración"}]}

NOTA:
${notaNueva.titulo}
${notaNueva.contenido.slice(0, 300)}

CANDIDATAS:
${listaCandidatas}`

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_PIPELINE })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
  })
  const text = result.response.text().trim()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.sugerencias ?? [])
    .slice(0, 5)
    .map((s: { notaId: string; tipoVinculo: VinculoZettel['tipo']; razon: string }) => {
      const notaRef = candidatas.find((n) => n.id === s.notaId)
      return {
        notaId: s.notaId,
        notaTitulo: notaRef?.titulo ?? s.notaId,
        tipoVinculo: s.tipoVinculo,
        razon: s.razon,
        confianza: 'alta' as const,
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

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_PIPELINE })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
  })
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
