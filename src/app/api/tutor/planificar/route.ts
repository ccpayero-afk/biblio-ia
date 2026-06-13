import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { semanticSearch } from '@/lib/search'
import { getGeminiClient, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { initUserDrive, findFile, readJSON, listPDFs } from '@/lib/drive'
import { Cita, Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// ─── Búsqueda académica via OpenAlex ─────────────────────────────────────────

interface WorkAcademico {
  titulo: string
  autores: string
  año: number | null
  revista: string
  citas: number
  doi: string | null
  urlAbierto: string | null
  abstract: string
}

function reconstruirAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return ''
  const mapa: [number, string][] = []
  for (const [palabra, posiciones] of Object.entries(invertedIndex)) {
    for (const pos of posiciones) mapa.push([pos, palabra])
  }
  return mapa.sort((a, b) => a[0] - b[0]).map(([, p]) => p).join(' ').slice(0, 400)
}

async function buscarFuentesAcademicas(query: string): Promise<WorkAcademico[]> {
  try {
    const q = encodeURIComponent(query.slice(0, 400))
    const url = `https://api.openalex.org/works?search=${q}&filter=type:article&sort=cited_by_count:desc&per-page=15&select=title,authorships,publication_year,primary_location,cited_by_count,open_access,doi,abstract_inverted_index`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BiblioIA/1.0 (mailto:payero.cristian@gmail.com)' },
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: { results?: any[] } = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results ?? []).slice(0, 12).map((w: any): WorkAcademico => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoresList = (w.authorships ?? []).slice(0, 3).map((a: any) => a.author?.display_name ?? '').filter(Boolean)
      const autores = autoresList.join(', ') + ((w.authorships?.length ?? 0) > 3 ? ' et al.' : '')
      return {
        titulo: w.title ?? 'Sin título',
        autores: autores || 'Autor desconocido',
        año: w.publication_year ?? null,
        revista: w.primary_location?.source?.display_name ?? '',
        citas: w.cited_by_count ?? 0,
        doi: w.doi ? w.doi.replace('https://doi.org/', '') : null,
        urlAbierto: w.open_access?.oa_url ?? null,
        abstract: reconstruirAbstract(w.abstract_inverted_index),
      }
    })
  } catch {
    return []
  }
}

const TIPO_LABEL: Record<string, string> = {
  articulo:  'artículo académico',
  tesis:     'tesis / disertación doctoral',
  clase:     'clase o seminario universitario',
  ponencia:  'ponencia / comunicación académica',
  capitulo:  'capítulo de libro',
  ensayo:    'ensayo académico',
}

const SISTEMA = `Sos un tutor académico experto con tres funciones integradas: metodólogo de la investigación, especialista en ciencias sociales latinoamericanas y planificador de producción académica. Tu trabajo es acompañar al usuario en todo el ciclo de una investigación: desde definir qué leer, hasta producir un texto académico riguroso.

No sos un asistente genérico. Sos un interlocutor académico crítico que ayuda a pensar, estructurar y producir con rigor.

## Capacidades centrales

Podés trabajar en distintos modos según la necesidad del usuario:
- **Exploración**: mapear un campo, identificar problemas relevantes y elegir un ángulo de investigación
- **Diseño**: estructurar el problema, la pregunta, el marco teórico y el plan de trabajo
- **Bibliográfico**: buscar, ordenar y orientar la lectura con criterio (qué leer, para qué y en qué momento)
- **Escritura**: estructurar secciones, revisar argumentación y mejorar el registro académico
- **Revisión crítica**: evaluar borradores con criterio metodológico y proponer reformulaciones concretas

## Marco disciplinar

Tu especialización es la **sociología, ciencia política, antropología, economía política y estudios latinoamericanos**. Dominás:
- Teoría social clásica: Marx, Weber, Durkheim, Simmel y sus derivaciones contemporáneas
- Teoría crítica y marxismo: Gramsci, Poulantzas, Althusser, Harvey, Jessop
- Teoría social latinoamericana: Mariátegui, Quijano, Zavaleta Mercado, Cardoso, Marini, Svampa, Zibechi
- Paradigmas metodológicos: estructuralismo, constructivismo, realismo crítico, poscolonialismo, IAP, enfoques feministas
- Áreas sustantivas: Estado, clases sociales, movimientos sociales, mercados de trabajo, desigualdad, colonialidad

## Criterios de calidad que aplicás siempre

Un buen trabajo en ciencias sociales debe tener: problema claro, tesis o posición sostenida, marco teórico operativo (no decorativo), coherencia metodológica, argumentación respaldada, consistencia interna entre pregunta y conclusión, registro académico preciso sin jerga innecesaria.

Cuando un borrador o plan no cumple estos criterios, decirlo con fundamento y proponer cómo corregirlo.

## Registro y tono

- Directo, sin elogios vacíos. No comenzar con "¡Excelente pregunta!" ni validar por defecto
- Crítico cuando corresponde: señalar problemas metodológicos o teóricos con fundamento
- Propositivo: siempre ofrecer una alternativa concreta, no solo señalar el problema
- Adaptable: ajustar el nivel de complejidad al perfil del usuario según se evidencie en la conversación
- Conciso: respuestas largas cuando el contenido lo exige, cortas cuando se trata de orientar

## Restricciones

Nunca inventás bibliografía. Solo citás textos que aparecen en la biblioteca del usuario o que podés verificar con certeza en tu conocimiento. Si un área temática no está cubierta por la biblioteca, lo señalás como gap explícito. Respondés en español académico rioplatense. Usás markdown: ## para títulos de sección, **negrita** para énfasis, - para listas.`

const SECCIONES_PROMPT = `Con toda esta información elaborá un plan académico detallado con EXACTAMENTE estas secciones en este orden:

## Diagnóstico del trabajo

Evaluá la propuesta del usuario: qué sabe, qué le falta construir, qué tensiones o problemas tiene el diseño planteado. Sé directo: señalá fortalezas pero también inconsistencias, ambigüedades o decisiones que el usuario aún no tomó y deberá tomar.

## Bibliografía recomendada

Para cada texto de la biblioteca que sea relevante explicá: (a) por qué es útil para este trabajo específico, (b) qué aporta teórica o empíricamente, (c) cómo puede articularse con los demás. Indicá explícitamente si faltan textos centrales para el tema (gap bibliográfico). Cuando cites un documento de la BIBLIOGRAFÍA COMPLETA DISPONIBLE, incluí el link tal como aparece en esa lista ([ver en biblioteca](/lector/DOCID)) para que el usuario pueda navegar directamente.

## Bibliografía sugerida

Listá textos que el usuario NO tiene en su biblioteca pero que son centrales o muy útiles para este tema. Para cada uno indicá con precisión: **Autor/es, Año. "Título". Editorial/Revista**. Luego en 2-3 líneas: qué argumento o concepto aporta, por qué es relevante para este trabajo específico, y si hay acceso abierto o es de difícil consecución. Priorizá textos clásicos del campo, artículos con alto impacto y materiales metodológicos si aplica. No inventes títulos: solo incluí textos que podés verificar con certeza en tu conocimiento.

## Estructura sugerida

Proponé una estructura de secciones completa con sus objetivos y contenidos. Vinculá cada sección con los textos disponibles y con el argumento central. Si es tesis, seguí estructura convencional; si es artículo, una más acotada. Para cada sección indicá qué debe resolver y qué fuentes la sostienen.

## Orientación metodológica

Recomendá el enfoque metodológico más adecuado para este problema y justificalo. Explicá cómo articular la perspectiva teórica con el material empírico o historiográfico disponible. Señalá las decisiones metodológicas clave que el investigador deberá tomar explícitamente (nivel de análisis, unidad de análisis, técnicas, fuentes primarias o secundarias, etc.).

## Hipótesis y preguntas orientadoras

Formulá la pregunta de investigación central con precisión. Luego, al menos tres preguntas secundarias derivadas. Si aplica, proponé una hipótesis provisional que el trabajo deberá sostener, discutir o refutar. Si la propuesta del usuario no tiene todavía una posición clara, indicarlo y proponer una.

## Citas y pasajes clave

Seleccioná los fragmentos más importantes de la biblioteca para el argumento central. Para cada uno indicá: texto de origen, qué dice exactamente, cómo usarlo en el trabajo y en qué sección encajaría. Usá el formato (Autor, Año, p. N).

## Gaps y desafíos

Identificá con precisión: (a) qué autores o debates relevantes están ausentes en la biblioteca, (b) qué limitaciones metodológicas o empíricas enfrentará este trabajo, (c) posibles objeciones al argumento central y cómo anticiparlas, (d) riesgos de la propuesta tal como está formulada.

## Primeros pasos concretos

Listá 6-8 acciones concretas, ordenadas y realizables para comenzar a trabajar. Cada acción debe ser específica (no "leer el marco teórico" sino "leer los capítulos X e Y de tal texto para construir el concepto Z"). Incluí lecturas prioritarias, decisiones que hay que tomar, y materiales a conseguir.`

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const {
      tipo = 'articulo',
      descripcion,
      perspectiva,
      buscarEnWeb = false,
      carpetasIds,
      seguimiento,
      planTexto,
    } = (await req.json()) as {
      tipo?: string
      descripcion?: string
      perspectiva?: string
      buscarEnWeb?: boolean
      carpetasIds?: string[]
      seguimiento?: string
      planTexto?: string
    }

    // ── Follow-up mode ────────────────────────────────────────────────────────
    if (seguimiento && planTexto) {
      const genAI = await getGeminiClient(accessToken)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = buscarEnWeb ? [{ googleSearch: {} } as any] : undefined
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION, systemInstruction: SISTEMA, tools })

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
            // Stream grounding sources if web search was used
            if (buscarEnWeb) {
              const resp = await result.response
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chunks = (resp.candidates?.[0] as any)?.groundingMetadata?.groundingChunks ?? []
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fuentes = chunks.filter((c: any) => c.web?.uri).map((c: any) => ({ titulo: c.web.title ?? c.web.uri, url: c.web.uri }))
              if (fuentes.length) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ fuentes })}\n\n`))
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

    const palabras = descripcion.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
    const matchTexto = (text: string) => palabras.some((p) => text.toLowerCase().includes(p))

    const timeout12s = <T>(fallback: T) =>
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 12_000))

    // 1. initUserDrive + academic search in parallel
    const [estructura, fuentesAcademicas] = await Promise.all([
      initUserDrive(accessToken),
      buscarEnWeb ? buscarFuentesAcademicas(descripcion) : Promise.resolve([] as WorkAcademico[]),
    ])

    // 2. Bibliography + notas + citas in parallel
    const [todosLosDocs, notasRaw, citasRaw] = await Promise.all([
      listPDFs(accessToken, estructura.pdfsId),
      findFile(accessToken, 'notas.json', estructura.notasId)
        .then((nid) => nid ? readJSON<Nota[]>(accessToken, nid) : [] as Nota[])
        .catch(() => [] as Nota[]),
      findFile(accessToken, 'citas.json', estructura.citasId)
        .then((cid) => cid ? readJSON<Cita[]>(accessToken, cid) : [] as Cita[])
        .catch(() => [] as Cita[]),
    ])

    // 3. Filter docs by selected carpetas
    const SIN_CARPETA_ID = '__sin_carpeta__'
    const docsParaUsar = carpetasIds?.length
      ? todosLosDocs.filter((d) =>
          d.carpetaId
            ? carpetasIds.includes(d.carpetaId)
            : carpetasIds.includes(SIN_CARPETA_ID),
        )
      : todosLosDocs
    const filteredDocIds = carpetasIds?.length ? docsParaUsar.map((d) => d.id) : undefined

    // 4. Semantic search with filtered IDs
    const fragmentos = await Promise.race([
      semanticSearch(descripcion, accessToken, { topK: 15, documentoIds: filteredDocIds }).catch(() => []),
      timeout12s([] as Awaited<ReturnType<typeof semanticSearch>>),
    ])

    const notasRelevantes = notasRaw.filter((n) => matchTexto(n.contenido ?? '') || matchTexto(n.titulo ?? '')).slice(0, 10)
    const citasRelevantes = citasRaw.filter((c) => matchTexto(c.texto ?? '')).slice(0, 10)

    // 3. Build prompt
    const tipoStr = TIPO_LABEL[tipo] ?? tipo

    const fragmentoStr = fragmentos.length
      ? fragmentos.map((f, i) =>
          `[${i + 1}] ${f.autor || 'Anónimo'} (${f.año || 's.f.'}), "${f.documentoNombre.replace(/\.pdf$/i, '')}", p. ${f.pagina}:\n"${f.texto}"`,
        ).join('\n\n')
      : '(Sin fragmentos indexados — indexá los PDFs en Biblioteca para obtener mejores resultados.)'

    const biblioStr = docsParaUsar
      .filter((d) => d.autor || d.titulo)
      .map((d) => `• ${d.autor || 'Anónimo'} (${d.año || 's.f.'}). ${d.titulo ?? d.nombre.replace(/\.pdf$/i, '')}${d.revista ? `. *${d.revista}*` : ''}. [ver en biblioteca](/lector/${d.id})`)
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
${carpetasIds?.length ? `\n**Nota:** El usuario filtró la búsqueda a ${docsParaUsar.length} documentos de carpetas específicas (de ${todosLosDocs.length} totales). Trabajá exclusivamente con esa selección.\n` : ''}
${buscarEnWeb ? '\n**Nota:** El usuario habilitó búsqueda en la web. Podés complementar con fuentes externas cuando la biblioteca no cubra un área relevante, pero priorizá siempre los textos de la biblioteca disponible.\n' : ''}

---
## FRAGMENTOS RELEVANTES DE LA BIBLIOTECA (búsqueda semántica)

${fragmentoStr}

---
## BIBLIOGRAFÍA COMPLETA DISPONIBLE

${biblioStr || '(Biblioteca vacía o sin metadatos)'}

${notasStr ? `---\n## NOTAS PROPIAS RELACIONADAS\n\n${notasStr}` : ''}
${citasStr ? `---\n## CITAS GUARDADAS RELACIONADAS\n\n${citasStr}` : ''}
${fuentesAcademicas.length ? `\n---\n## FUENTES ACADÉMICAS EXTERNAS (OpenAlex — NO en la biblioteca del usuario)\n\nEstos textos fueron hallados por búsqueda masiva. El usuario NO los tiene. Para cada uno relevante indicá por qué sería útil y cómo conseguirlo.\n\n${fuentesAcademicas.map((f) => `• ${f.autores} (${f.año ?? 's.f.'}). "${f.titulo}".${f.revista ? ` *${f.revista}*.` : ''}${f.citas > 0 ? ` [${f.citas} citas]` : ''}${f.doi ? ` DOI: ${f.doi}` : ''}${f.urlAbierto ? ` [ACCESO ABIERTO]` : ''}${f.abstract ? `\n  Resumen: ${f.abstract}` : ''}`).join('\n\n')}` : ''}

---
${SECCIONES_PROMPT}`

    // 4. Stream response
    const genAI = await getGeminiClient(accessToken)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = buscarEnWeb ? [{ googleSearch: {} } as any] : undefined
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION, systemInstruction: SISTEMA, tools })

    const metadatos = {
      docsRelevantes: fragmentos.slice(0, 8).map((f) => ({
        id: f.documentoId, nombre: f.documentoNombre, autor: f.autor, año: f.año,
      })),
      totalDocs: docsParaUsar.length,
      fragmentosAnalizados: fragmentos.length,
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: metadatos })}\n\n`))
          // Send academic sources immediately so the UI can display them while text streams
          if (fuentesAcademicas.length) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ fuentesAcademicas })}\n\n`))
          }
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
