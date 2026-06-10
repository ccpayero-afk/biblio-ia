import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, readJSON, writeJSON, findFile } from '@/lib/drive'
import { getGeminiClient, GEMINI_MODEL_GENERATION, geminiRateLimitMessage } from '@/lib/gemini'
import { downloadPDFBuffer } from '@/lib/indexer'
import { extractAnnotations, extractHighlightPageNumbers } from '@/lib/pdf-annotations'
import { crearCita } from '@/lib/citas'
import { saveFicha } from '@/lib/ficha'
import { Cita, Nota, FichaLectura } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)

    // Obtener metadatos del documento
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    const doc = documentos.find((d) => d.id === documentoId)
    if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // Descargar PDF y extraer anotaciones
    const buffer = await downloadPDFBuffer(accessToken, documentoId)
    let anotaciones = await extractAnnotations(buffer.buffer as ArrayBuffer)

    // Fallback: si no se pudo extraer texto (pdfjs no disponible en el entorno),
    // usar el texto completo de las páginas con highlights como contexto para Gemini
    if (anotaciones.length === 0) {
      const paginasConHL = await extractHighlightPageNumbers(buffer.buffer as ArrayBuffer)

      if (paginasConHL.length === 0) {
        return NextResponse.json({
          ok: true,
          anotaciones: 0,
          mensaje: 'Este PDF no tiene anotaciones de highlight. Abrí el PDF en Foxit, Adobe o cualquier lector y resaltá texto antes de procesar.',
          citasCreadas: 0,
          notasCreadas: 0,
          fichaCreada: false,
        })
      }

      // Extraer texto por página usando unpdf (confiable en Vercel)
      const { extractText } = await import('unpdf')
      const { text: textoPorPagina } = await extractText(
        new Uint8Array(buffer),
        { mergePages: false }
      )
      const paginas = Array.isArray(textoPorPagina) ? textoPorPagina : [textoPorPagina]

      // Agrupar highlights por página y tomar el texto de cada página
      const paginasUnicas = [...new Set(paginasConHL)].sort((a, b) => a - b)
      anotaciones = paginasUnicas
        .map(pagina => {
          const texto = paginas[pagina - 1]?.trim() ?? ''
          const countHL = paginasConHL.filter(p => p === pagina).length
          return {
            texto: texto.slice(0, 800),
            pagina,
            color: 'amarillo' as const,
            rect: [] as number[],
            tipo: 'Highlight' as const,
            _esContextoPagina: true,
            _cantidadHighlights: countHL,
          }
        })
        .filter(a => a.texto.length > 30)

      if (anotaciones.length === 0) {
        return NextResponse.json({
          ok: true,
          anotaciones: 0,
          mensaje: 'Se detectaron highlights pero no se pudo extraer el texto del PDF (puede ser un PDF escaneado sin capa de texto).',
          citasCreadas: 0,
          notasCreadas: 0,
          fichaCreada: false,
        })
      }
    }

    // Limitar a 25 entradas para no superar límites de tokens por minuto
    const sample = anotaciones.slice(0, 25)
    const esContextoPagina = (sample[0] as { _esContextoPagina?: boolean })?._esContextoPagina ?? false
    const listaHighlights = sample
      .map((a, i) => {
        const cantHL = (a as { _cantidadHighlights?: number })._cantidadHighlights
        const label = esContextoPagina
          ? `[${i + 1}] (p.${a.pagina}, ${cantHL ?? '?'} highlights) "${a.texto}"`
          : `[${i + 1}] (p.${a.pagina}) "${a.texto}"`
        return label
      })
      .join('\n')

    const titulo = doc.nombre.replace(/\.pdf$/i, '')
    const fuenteLabel = esContextoPagina
      ? 'El investigador resaltó texto en estas páginas, pero el PDF no almacenó el texto exacto resaltado — analizá el contenido completo de cada página para extraer lo más relevante.'
      : 'El investigador resaltó estos fragmentos del texto.'

    const prompt = `Sos un asistente de investigación académica especializado en ciencias sociales latinoamericanas.
${fuenteLabel}
El investigador no va a volver a leer este texto. Tu trabajo es extraer todo lo que va a necesitar para escribir artículos, armar marcos teóricos y repasar conceptos.

DOCUMENTO: "${titulo}" — ${doc.autor || 'Autor desconocido'} (${doc.año || 's.f.'})

${esContextoPagina ? 'PÁGINAS CON HIGHLIGHTS:' : 'FRAGMENTOS RESALTADOS:'}
${listaHighlights}

Respondé ÚNICAMENTE con JSON válido con esta estructura:
{
  "citas_directas": [
    {
      "texto": "cita textual exacta, sin parafrasear",
      "pagina": 0,
      "formato_apa": "Apellido (Año, p. N)",
      "cuando_usarla": "una oración: qué argumento propio sostendría esta cita"
    }
  ],
  "conceptos_teoricos": [
    {
      "concepto": "nombre del concepto o categoría analítica",
      "definicion": "cómo lo define este autor en este texto específico",
      "pagina": 0,
      "nota": "tensión con otras corrientes o definiciones si existe, o string vacío"
    }
  ],
  "ideas_clave": [
    {
      "idea": "idea reformulada con palabras propias — NO cita textual",
      "pagina": 0,
      "referencia_apa": "Apellido (Año, p. N)",
      "para_que_sirve": "en qué tipo de argumento o sección de artículo encaja"
    }
  ],
  "argumento_central": "tesis o argumento principal del texto en 2-3 oraciones",
  "posicion_en_debate": "con qué corriente teórica dialoga o discute este texto",
  "metodologia": "enfoque metodológico utilizado o mencionado, o string vacío si no se puede inferir",
  "referencias_citadas": ["Apellido (año) — tema o argumento que aporta al texto"],
  "palabras_clave": ["keyword1", "keyword2", "keyword3"]
}`

    const genAI = await getGeminiClient(accessToken)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    const result = await model.generateContent(prompt)
    const rawText = result.response.text()

    // Parsear JSON de la respuesta
    let parsed: {
      citas_directas: Array<{
        texto: string
        pagina: number
        formato_apa: string
        cuando_usarla: string
      }>
      conceptos_teoricos: Array<{
        concepto: string
        definicion: string
        pagina: number
        nota?: string
      }>
      ideas_clave: Array<{
        idea: string
        pagina: number
        referencia_apa: string
        para_que_sirve: string
      }>
      argumento_central: string
      posicion_en_debate: string
      metodologia?: string
      referencias_citadas?: string[]
      palabras_clave?: string[]
    }

    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'Gemini no devolvió JSON válido. Intentá de nuevo.' }, { status: 500 })
    }

    // --- Guardar citas directas ---
    const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    let citasExistentes: Cita[] = []
    if (citasFileId) {
      try { citasExistentes = await readJSON<Cita[]>(accessToken, citasFileId) } catch { /* noop */ }
    }

    const citasNuevas: Cita[] = []
    for (const c of parsed.citas_directas ?? []) {
      if (!c.texto?.trim()) continue
      const cita = crearCita({
        texto: c.texto,
        pagina: c.pagina ?? 1,
        documentoId: doc.id,
        documentoNombre: doc.nombre,
        autor: doc.autor,
        año: doc.año,
        notaPropia: c.cuando_usarla,
        etiquetas: ['highlights-pdf'],
      })
      citasNuevas.push(cita)
    }
    if (citasNuevas.length > 0) {
      await writeJSON(accessToken, estructura.citasId, 'citas.json', [...citasExistentes, ...citasNuevas])
    }

    // --- Guardar notas: conceptos teóricos + ideas clave ---
    const notasFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    let notasExistentes: Nota[] = []
    if (notasFileId) {
      try { notasExistentes = await readJSON<Nota[]>(accessToken, notasFileId) } catch { /* noop */ }
    }

    const ts = Date.now()
    const rand = () => Math.random().toString(36).slice(2, 6)

    const notasConceptos: Nota[] = (parsed.conceptos_teoricos ?? [])
      .filter((c) => c.concepto?.trim() && c.definicion?.trim())
      .map((c) => ({
        id: `nota_concepto_${ts}_${rand()}`,
        titulo: `[Concepto] ${c.concepto} — ${titulo}`,
        contenido: `**${c.concepto}** (${doc.autor || 'Autor'}, ${doc.año || 's.f.'}, p.${c.pagina})\n\n${c.definicion}${c.nota ? `\n\n*${c.nota}*` : ''}`,
        tipo: 'referencia' as const,
        vinculos: [],
        documentoOrigenId: doc.id,
        paginaOrigen: c.pagina,
        etiquetas: ['concepto-teorico', 'highlights-pdf'],
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString(),
      }))

    const notasIdeas: Nota[] = (parsed.ideas_clave ?? [])
      .filter((c) => c.idea?.trim())
      .map((c) => ({
        id: `nota_idea_${ts}_${rand()}`,
        titulo: `[Idea] ${c.idea.slice(0, 60)}${c.idea.length > 60 ? '…' : ''} — ${titulo}`,
        contenido: `${c.idea}\n\n*(${c.referencia_apa})*\n\n**Útil para:** ${c.para_que_sirve}`,
        tipo: 'referencia' as const,
        vinculos: [],
        documentoOrigenId: doc.id,
        paginaOrigen: c.pagina,
        etiquetas: ['idea-clave', 'highlights-pdf'],
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString(),
      }))

    const notasNuevas = [...notasConceptos, ...notasIdeas]
    if (notasNuevas.length > 0) {
      await writeJSON(accessToken, estructura.notasId, 'notas.json', [...notasExistentes, ...notasNuevas])
    }

    // --- Guardar ficha ---
    let fichaCreada = false
    if (parsed.argumento_central) {
      const fichaExistenteId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
      if (!fichaExistenteId || !doc.fichaGenerada) {
        const ficha: FichaLectura = {
          documentoId,
          tesisCentral: parsed.argumento_central,
          argumentoPrincipal: parsed.argumento_central,
          conceptosClave: (parsed.conceptos_teoricos ?? []).map((c) => ({
            concepto: c.concepto,
            definicion: c.definicion,
          })),
          posicionDebate: parsed.posicion_en_debate ?? '',
          citasDestacadas: citasNuevas.slice(0, 5).map((c) => ({ texto: c.texto, pagina: c.pagina })),
          limitaciones: '',
          relevancia: '',
          metodologia: parsed.metodologia || undefined,
          referenciasCitadas: parsed.referencias_citadas?.length ? parsed.referencias_citadas : undefined,
          palabrasClave: parsed.palabras_clave?.length ? parsed.palabras_clave : undefined,
          generadaEn: new Date().toISOString(),
        }
        await saveFicha(ficha, accessToken)
        fichaCreada = true
      }
    }

    // --- Guardar highlights en highlights/{documentoId}.json ---
    const hlNombre = `${documentoId}.json`
    const hlFileId = await findFile(accessToken, hlNombre, estructura.highlightsId)
    let hlExistentes: unknown[] = []
    if (hlFileId) {
      try { hlExistentes = await readJSON<unknown[]>(accessToken, hlFileId) } catch { /* noop */ }
    }
    const hlNuevos = sample.map((a) => ({
      id: `h_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      documentoId,
      texto: a.texto,
      pagina: a.pagina,
      posicion: { x: a.rect[0] ?? 0, y: a.rect[1] ?? 0, width: 0, height: 0 },
      color: (['amarillo', 'azul', 'rojo'].includes(a.color) ? a.color : 'amarillo') as 'amarillo' | 'azul' | 'rojo',
      nota: undefined,
      creadoEn: new Date().toISOString(),
    }))
    await writeJSON(accessToken, estructura.highlightsId, hlNombre, [...(hlExistentes as object[]), ...hlNuevos])

    return NextResponse.json({
      ok: true,
      anotaciones: anotaciones.length,
      procesadas: sample.length,
      citasCreadas: citasNuevas.length,
      conceptosCreados: notasConceptos.length,
      ideasCreadas: notasIdeas.length,
      notasCreadas: notasNuevas.length,
      fichaCreada,
    })
  } catch (e) {
    const rateLimitMsg = geminiRateLimitMessage(e)
    if (rateLimitMsg) {
      return NextResponse.json({ error: rateLimitMsg }, { status: 429 })
    }
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
