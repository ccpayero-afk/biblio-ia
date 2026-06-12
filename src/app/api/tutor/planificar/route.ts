import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { initUserDrive, findFile, readJSON, listPDFs } from '@/lib/drive'
import { Cita, Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const TIPO_LABEL: Record<string, string> = {
  articulo:  'artículo académico',
  tesis:     'tesis / disertación doctoral',
  clase:     'clase o seminario universitario',
  ponencia:  'ponencia / comunicación académica',
  capitulo:  'capítulo de libro',
  ensayo:    'ensayo académico',
}

const SISTEMA = `Sos un tutor metodológico académico especializado en ciencias sociales latinoamericanas.
Tu rol es guiar la planificación de trabajos académicos con rigor intelectual.
Nunca inventás bibliografía. Solo citás textos que aparecen en la biblioteca del usuario.
Si un área temática no está cubierta por la biblioteca, lo señalás como gap explícitamente.
Respondés en español académico: preciso, sin retórica, orientado a la acción.
Usás markdown: ## para títulos de sección, **negrita** para énfasis, - para listas.`

const SECCIONES_PROMPT = `Con toda esta información elaborá un plan académico detallado con EXACTAMENTE estas secciones en este orden:

## Bibliografía recomendada

Para cada texto de la biblioteca que sea relevante explicá: (a) por qué es útil, (b) qué aporta teórica o empíricamente, (c) cómo puede articularse con los demás. Indicá si falta algún texto central para el tema.

## Estructura sugerida

Proponé una estructura de secciones con sus objetivos y contenidos. Vinculá cada sección con los textos disponibles. Si es una tesis, seguí una estructura convencional; si es un artículo, una más acotada.

## Orientación metodológica

Recomendá el enfoque metodológico más adecuado. Explicá cómo articular la perspectiva teórica con el material empírico o historiográfico disponible. Señalá decisiones metodológicas clave que el investigador deberá tomar.

## Hipótesis y preguntas orientadoras

Formulá la pregunta de investigación central y al menos tres preguntas secundarias derivadas. Si aplica, proponé una hipótesis provisional que el trabajo deberá sostener, discutir o refutar.

## Citas y pasajes clave

Seleccioná los fragmentos más citables o importantes para el argumento. Para cada uno indicá: el texto de origen, cómo usarlo, y en qué sección del trabajo encajaría. Usá el formato (Autor, Año, p. N).

## Gaps y desafíos

Identificá: (a) qué temas o autores relevantes están ausentes en la biblioteca, (b) qué limitaciones metodológicas o empíricas enfrentará el trabajo, (c) posibles objeciones al argumento central.

## Primeros pasos concretos

Listá 6-8 acciones concretas y ordenadas para comenzar a trabajar. Incluí lecturas prioritarias, decisiones que hay que tomar, y materiales a buscar.`

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const {
      tipo = 'articulo',
      descripcion,
      perspectiva,
      seguimiento,      // follow-up message after initial plan
      planTexto,        // full plan text for follow-up context
    } = (await req.json()) as {
      tipo?: string
      descripcion?: string
      perspectiva?: string
      seguimiento?: string
      planTexto?: string
    }

    // ── Follow-up mode ────────────────────────────────────────────────────────
    if (seguimiento && planTexto) {
      const genAI = await getGeminiClient(accessToken)
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION, systemInstruction: SISTEMA })

      const prompt = `Este es el plan académico que elaboraste previamente:\n\n${planTexto}\n\n---\nEl usuario tiene una pregunta o solicitud de ajuste:\n\n"${seguimiento}"\n\nRespondé de forma concisa, precisa y académica. Si el usuario pide cambiar la estructura o agregar contenido, integralo con lo ya planificado.`

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await model.generateContentStream(prompt)
            for await (const chunk of result.stream) {
              const text = chunk.text()
              if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: text })}\n\n`))
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          } catch (e) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new NextResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }

    // ── Initial plan mode ─────────────────────────────────────────────────────
    if (!descripcion?.trim()) return NextResponse.json({ error: 'Falta la descripción del trabajo' }, { status: 400 })

    // 1. Semantic search — top 15 fragments
    const fragmentos = await semanticSearch(descripcion, accessToken, { topK: 15 })

    // 2. Full bibliography for context
    const estructura   = await initUserDrive(accessToken)
    const todosLosDocs = await listPDFs(accessToken, estructura.pdfsId)

    // 3. Notas and citas — keyword relevance filter
    const palabras = descripcion.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
    const matchTexto = (text: string) => palabras.some((p) => text.toLowerCase().includes(p))

    let notasRelevantes: Nota[]  = []
    let citasRelevantes: Cita[]  = []
    try {
      const nid = await findFile(accessToken, 'notas.json', estructura.notasId)
      if (nid) {
        const notas = await readJSON<Nota[]>(accessToken, nid)
        notasRelevantes = notas.filter((n) => matchTexto(n.contenido ?? '') || matchTexto(n.titulo ?? '')).slice(0, 10)
      }
    } catch { /* best effort */ }
    try {
      const cid = await findFile(accessToken, 'citas.json', estructura.citasId)
      if (cid) {
        const citas = await readJSON<Cita[]>(accessToken, cid)
        citasRelevantes = citas.filter((c) => matchTexto(c.texto ?? '')).slice(0, 10)
      }
    } catch { /* best effort */ }

    // 4. Build prompt context
    const tipoStr = TIPO_LABEL[tipo] ?? tipo

    const fragmentoStr = fragmentos.length
      ? fragmentos.map((f, i) =>
          `[${i + 1}] ${f.autor || 'Anónimo'} (${f.año || 's.f.'}), "${f.documentoNombre.replace(/\.pdf$/i, '')}", p. ${f.pagina}:\n"${f.texto}"`,
        ).join('\n\n')
      : '(Sin fragmentos indexados — indexá los PDFs en Biblioteca para obtener mejores resultados.)'

    const biblioStr = todosLosDocs
      .filter((d) => d.autor || d.titulo)
      .map((d) => `• ${d.autor || 'Anónimo'} (${d.año || 's.f.'}). ${d.titulo ?? d.nombre.replace(/\.pdf$/i, '')}${d.revista ? `. *${d.revista}*` : ''}${d.doi ? `. DOI: ${d.doi}` : ''}.`)
      .join('\n')

    const notasStr = notasRelevantes.length
      ? notasRelevantes.map((n) => `• [${n.tipo}] ${n.titulo ? `**${n.titulo}**` : ''}: ${n.contenido?.slice(0, 250) ?? ''}`).join('\n')
      : ''

    const citasStr = citasRelevantes.length
      ? citasRelevantes.map((c) => `• "${c.texto?.slice(0, 250) ?? ''}" — ${c.autor || ''} (${c.documentoNombre ?? ''})`).join('\n')
      : ''

    const prompt = `El usuario quiere elaborar un **${tipoStr}** sobre el siguiente tema:

> "${descripcion.trim()}"
${perspectiva ? `\n**Perspectiva o enfoque declarado:** ${perspectiva}\n` : ''}

---
## FRAGMENTOS RELEVANTES DE LA BIBLIOTECA (búsqueda semántica)

${fragmentoStr}

---
## BIBLIOGRAFÍA COMPLETA DISPONIBLE

${biblioStr || '(Biblioteca vacía o sin metadatos)'}

${notasStr ? `---\n## NOTAS PROPIAS RELACIONADAS\n\n${notasStr}` : ''}
${citasStr ? `---\n## CITAS GUARDADAS RELACIONADAS\n\n${citasStr}` : ''}

---
${SECCIONES_PROMPT}`

    // 5. Stream response
    const genAI = await getGeminiClient(accessToken)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION, systemInstruction: SISTEMA })

    const metadatos = {
      docsRelevantes: fragmentos.slice(0, 8).map((f) => ({
        id: f.documentoId, nombre: f.documentoNombre, autor: f.autor, año: f.año,
      })),
      totalDocs: todosLosDocs.length,
      fragmentosAnalizados: fragmentos.length,
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: metadatos })}\n\n`))
          const result = await model.generateContentStream(prompt)
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: text })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
