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
    const contextoInstruccion = esContextoPagina
      ? `Te doy el texto completo de páginas que contienen highlights (el lector resaltó texto en esas páginas, pero el formato del PDF no almacenó el texto exacto resaltado).
Analizá el contenido de esas páginas para identificar los fragmentos más relevantes para investigación.`
      : `Te doy fragmentos resaltados de un texto académico con sus páginas.`

    const prompt = `Sos un asistente de investigación académica especializado en ciencias sociales latinoamericanas.
${contextoInstruccion}

Tu tarea:

1. CITAS: Para cada ${esContextoPagina ? 'página' : 'fragmento'}, identificar 1-2 citas directas relevantes para investigación.
   Formatearlas como citas académicas listas para usar en un artículo.

2. NOTA DE CONTEXTO: Para cada cita identificada, escribir 1-2 oraciones sobre por qué es teóricamente relevante.

3. FICHA SINTÉTICA: A partir del conjunto de ${esContextoPagina ? 'páginas con highlights' : 'highlights'}, inferir:
   - tesis_central del texto
   - conceptos_clave (array de strings)
   - tensiones_detectadas (string)
   - posicion_debate (string)

Documento: "${titulo}" — ${doc.autor || 'Autor desconocido'} (${doc.año || 's.f.'})

${esContextoPagina ? 'Páginas con highlights:' : 'Fragmentos resaltados:'}
${listaHighlights}

Respondé ÚNICAMENTE con JSON válido con esta estructura exacta:
{
  "citas": [
    {
      "fragmento_original": "...",
      "pagina": N,
      "es_cita_relevante": true,
      "nota_contexto": "...",
      "formato_apa": "Apellido (Año, p. N)."
    }
  ],
  "ficha": {
    "tesis_central": "...",
    "conceptos_clave": ["concepto1", "concepto2"],
    "tensiones_detectadas": "...",
    "posicion_debate": "..."
  }
}`

    const genAI = await getGeminiClient(accessToken)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    const result = await model.generateContent(prompt)
    const rawText = result.response.text()

    // Parsear JSON de la respuesta
    let parsed: {
      citas: Array<{
        fragmento_original: string
        pagina: number
        es_cita_relevante: boolean
        nota_contexto: string
        formato_apa: string
      }>
      ficha: {
        tesis_central: string
        conceptos_clave: string[]
        tensiones_detectadas: string
        posicion_debate: string
      }
    }

    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawText
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'Gemini no devolvió JSON válido. Intentá de nuevo.' }, { status: 500 })
    }

    // --- Guardar citas ---
    const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    let citasExistentes: Cita[] = []
    if (citasFileId) {
      try { citasExistentes = await readJSON<Cita[]>(accessToken, citasFileId) } catch { /* noop */ }
    }

    const citasNuevas: Cita[] = []
    for (const c of parsed.citas ?? []) {
      if (!c.es_cita_relevante) continue
      const annotacion = sample.find((a) => a.texto === c.fragmento_original || a.pagina === c.pagina)
      const cita = crearCita({
        texto: c.fragmento_original,
        pagina: annotacion?.pagina ?? c.pagina ?? 1,
        documentoId: doc.id,
        documentoNombre: doc.nombre,
        autor: doc.autor,
        año: doc.año,
        notaPropia: c.nota_contexto,
        etiquetas: ['highlights-pdf'],
      })
      citasNuevas.push(cita)
    }
    if (citasNuevas.length > 0) {
      await writeJSON(accessToken, estructura.citasId, 'citas.json', [...citasExistentes, ...citasNuevas])
    }

    // --- Guardar notas de contexto ---
    const notasFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    let notasExistentes: Nota[] = []
    if (notasFileId) {
      try { notasExistentes = await readJSON<Nota[]>(accessToken, notasFileId) } catch { /* noop */ }
    }

    const notasNuevas: Nota[] = (parsed.citas ?? [])
      .filter((c) => c.nota_contexto?.trim())
      .map((c) => ({
        id: `nota_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        titulo: `[${titulo}, p.${c.pagina}]`,
        contenido: `[${titulo}, p.${c.pagina}] ${c.nota_contexto}`,
        documentoId: doc.id,
        documentoOrigenId: doc.id,
        pagina: c.pagina,
        paginaOrigen: c.pagina,
        fragmentoTexto: c.fragmento_original,
        etiquetas: ['highlights-pdf', 'ia'],
        tipo: 'efimera' as const,
        vinculos: [],
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString(),
      }))

    if (notasNuevas.length > 0) {
      await writeJSON(accessToken, estructura.notasId, 'notas.json', [...notasExistentes, ...notasNuevas])
    }

    // --- Guardar ficha (solo si el documento no tiene ficha o si la generamos desde highlights) ---
    let fichaCreada = false
    if (parsed.ficha?.tesis_central) {
      const fichaExistenteId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
      if (!fichaExistenteId || !doc.fichaGenerada) {
        const ficha: FichaLectura = {
          documentoId,
          tesisCentral: parsed.ficha.tesis_central,
          argumentoPrincipal: parsed.ficha.tesis_central,
          conceptosClave: (parsed.ficha.conceptos_clave ?? []).map((c) => ({ concepto: c, definicion: '' })),
          posicionDebate: parsed.ficha.posicion_debate ?? '',
          citasDestacadas: citasNuevas.slice(0, 5).map((c) => ({ texto: c.texto, pagina: c.pagina })),
          limitaciones: parsed.ficha.tensiones_detectadas ?? '',
          relevancia: '',
          generadaEn: new Date().toISOString(),
        }
        await saveFicha(ficha, accessToken)
        fichaCreada = true
      }
    }

    // --- Guardar highlights propios en highlights/{documentoId}.json ---
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
    const hlTodos = [...(hlExistentes as object[]), ...hlNuevos]
    await writeJSON(accessToken, estructura.highlightsId, hlNombre, hlTodos)

    return NextResponse.json({
      ok: true,
      anotaciones: anotaciones.length,
      procesadas: sample.length,
      citasCreadas: citasNuevas.length,
      notasCreadas: notasNuevas.length,
      fichaCreada,
    })
  } catch (e) {
    const msg = String(e)
    const rateLimitMsg = geminiRateLimitMessage(e)
    if (rateLimitMsg) {
      return NextResponse.json({ error: rateLimitMsg }, { status: 429 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
