import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice } from '@/lib/notas'
import { leerCitas } from '@/lib/citas'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { semanticSearch } from '@/lib/search'
import { NextRequest, NextResponse } from 'next/server'
import type { NotaLigera } from '@/lib/notas'
import type { Cita, Documento } from '@/types'

export const maxDuration = 60

export interface Recomendacion {
  tipo: 'cita' | 'nota' | 'documento'
  itemId: string
  titulo: string
  autor?: string
  parrafo: string
  razon: string
  relevancia: 'alta' | 'media'
  fragmento?: string
}

// Score a text by keyword overlap with the query (simple relevance proxy, no API needed)
function scoreRelevancia(texto: string, queryTerms: Set<string>): number {
  const lower = texto.toLowerCase()
  return [...queryTerms].filter((t) => lower.includes(t)).length
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { texto, carpetasIds } = (await req.json()) as { texto: string; carpetasIds?: string[] }

    if (!texto?.trim()) return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })

    const textoLimitado = texto.slice(0, 12000)

    // Extract keywords for relevance pre-filtering (words > 4 chars, skip stopwords)
    const stopwords = new Set([
      'para', 'como', 'esto', 'esta', 'estos', 'estas', 'pero', 'cuando', 'donde', 'desde',
      'hasta', 'sobre', 'entre', 'bajo', 'ante', 'tras', 'that', 'this', 'from', 'have',
      'they', 'their', 'which', 'with', 'también', 'porque', 'aunque', 'según', 'hacia',
      'después', 'antes', 'durante', 'mediante', 'través', 'partir',
    ])
    const queryTerms = new Set(
      textoLimitado
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4 && !stopwords.has(w))
        .slice(0, 100)
    )

    const [{ indice }, { citas }, estructura] = await Promise.all([
      leerIndice(accessToken),
      leerCitas(accessToken),
      initUserDrive(accessToken),
    ])
    const todosLosDocumentos = await listPDFs(accessToken, estructura.pdfsId)
    const documentos = carpetasIds?.length
      ? todosLosDocumentos.filter((d) => carpetasIds.includes(d.carpetaId ?? ''))
      : todosLosDocumentos

    const citasMap = new Map<string, Cita>()
    const notasMap = new Map<string, NotaLigera>()
    const docsMap = new Map<string, Documento>()
    const partes: string[] = []

    // Citas — ordenadas por relevancia al texto
    type NotaConContenido = NotaLigera & { contenido?: string }
    const citasOrdenadas = [...citas]
      .map((c) => ({
        c,
        score: scoreRelevancia(`${c.texto} ${c.etiquetas.join(' ')}`, queryTerms),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.c)

    if (citasOrdenadas.length > 0) {
      partes.push('=== CITAS GUARDADAS ===')
      citasOrdenadas.forEach((c, i) => {
        const key = `c${i + 1}`
        citasMap.set(key, c)
        const etiq = c.etiquetas?.length ? ` [${c.etiquetas.join(', ')}]` : ''
        partes.push(`[${key}] "${c.texto.slice(0, 150)}" — ${c.formatoAPA}${etiq}`)
      })
    }

    // Notas — ordenadas por relevancia al texto
    const notasOrdenadas = (indice as NotaConContenido[])
      .filter((n) => n.tipo !== 'efimera')
      .map((n) => ({
        n,
        score: scoreRelevancia(
          `${n.titulo} ${n.contenido ?? ''} ${n.etiquetas.join(' ')}`,
          queryTerms
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.n)

    if (notasOrdenadas.length > 0) {
      partes.push('\n=== NOTAS PERSONALES ===')
      notasOrdenadas.forEach((n, i) => {
        const key = `n${i + 1}`
        notasMap.set(key, n)
        const etiq = n.etiquetas?.length ? ` [${n.etiquetas.join(', ')}]` : ''
        const snippet = n.contenido
          ? ` — "${n.contenido.slice(0, 120).replace(/\n/g, ' ')}"`
          : n.comentarioPersonal
          ? ` — "${n.comentarioPersonal.slice(0, 80)}"`
          : ''
        partes.push(`[${key}] "${n.titulo}"${etiq}${snippet}`)
      })
    }

    // Documentos — ordenados por relevancia al texto (abstract + título + autor)
    const docsOrdenados = [...documentos]
      .map((d) => ({
        d,
        score: scoreRelevancia(
          `${d.titulo ?? ''} ${d.nombre} ${d.autor} ${d.abstract ?? ''} ${d.etiquetas.join(' ')}`,
          queryTerms
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.d)

    if (docsOrdenados.length > 0) {
      partes.push('\n=== DOCUMENTOS EN BIBLIOTECA ===')
      docsOrdenados.forEach((d, i) => {
        const key = `d${i + 1}`
        docsMap.set(key, d)
        const info = [d.titulo || d.nombre.replace(/\.pdf$/i, ''), d.autor, d.año]
          .filter(Boolean)
          .join(' — ')
        const abs = d.abstract ? ` — Abstract: "${d.abstract.slice(0, 100)}"` : ''
        partes.push(`[${key}] ${info}${abs}`)
      })
    }

    // Búsqueda semántica sobre el contenido indexado de los documentos en scope
    const docIdsIndexados = docsOrdenados
      .filter((d) => d.estado === 'indexado' && d.fragmentos > 0)
      .map((d) => d.id)

    let fragmentosIncluidos = 0
    let errorFragmentos: string | null = null

    if (docIdsIndexados.length > 0) {
      try {
        const fragmentos = await semanticSearch(textoLimitado.slice(0, 1500), accessToken, {
          documentoIds: docIdsIndexados,
          topK: 10,
        })
        if (fragmentos.length > 0) {
          partes.push('\n=== EXTRACTOS DE CONTENIDO (texto real indexado de los documentos) ===')
          fragmentos.forEach((f) => {
            const docIdx = docsOrdenados.findIndex((d) => d.id === f.documentoId)
            if (docIdx < 0) return
            const docKey = `d${docIdx + 1}`
            const snip = f.texto.slice(0, 400).replace(/\n/g, ' ')
            partes.push(`[${docKey}] p.${f.pagina}: "${snip}"`)
            fragmentosIncluidos++
          })
        }
      } catch (e) {
        errorFragmentos = String(e)
      }
    }

    const catalogo = partes.join('\n')

    if (!catalogo.trim()) {
      return NextResponse.json({
        analisis:
          'Tu biblioteca está vacía. Importá documentos, guardá citas o creá notas para poder hacer recomendaciones.',
        recomendaciones: [],
        fragmentosIncluidos: 0,
      })
    }

    const prompt =
      `Sos un asistente de investigación académica. Analizá el texto del usuario e identificá qué recursos de su biblioteca personal complementan, apoyan o enriquecen ese texto.\n\n` +
      `TEXTO A ANALIZAR:\n${textoLimitado}\n\n` +
      `BIBLIOTECA DEL USUARIO:\n${catalogo}\n\n` +
      `Instrucciones:\n` +
      `- Todos los recursos del catálogo ya están pre-ordenados por relevancia al texto\n` +
      `- Los "EXTRACTOS DE CONTENIDO" son texto real extraído de los PDFs indexados — usálos para entender el contenido real de cada documento y citá fragmentos concretos en la 'razon'\n` +
      `- Identificá los temas, argumentos y conceptos centrales del texto\n` +
      `- Relacioná cada recurso relevante con una parte específica del texto\n` +
      `- Priorizá por relevancia real: 5-10 recomendaciones en total\n` +
      `- Si un recurso no aporta concretamente, no lo incluyas\n\n` +
      `Respondé ÚNICAMENTE con JSON puro:\n` +
      `{"analisis":"2-3 oraciones sobre los temas del texto y qué tipo de complemento necesita","recomendaciones":[{"tipo":"cita","itemId":"c1","titulo":"título breve","autor":"apellido si aplica","parrafo":"frase del texto del usuario que justifica esta recomendación","razon":"por qué este recurso complementa esa parte — si hay extracto del doc, mencioná algo concreto de él (1-2 oraciones)","relevancia":"alta","fragmento":"primeras palabras del recurso (máx 80 chars)"}]}`

    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent(prompt)
    })

    let txt = result.response.text().trim()
    if (txt.includes('```')) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
    const parsed = JSON.parse(txt) as {
      analisis: string
      recomendaciones: Array<Recomendacion & { itemId: string }>
    }

    // Resolve short keys → real IDs and fill in real data
    const recomendaciones: Recomendacion[] = parsed.recomendaciones
      .map((r) => {
        if (r.tipo === 'cita') {
          const cita = citasMap.get(r.itemId)
          if (!cita) return null
          return { ...r, itemId: cita.id, fragmento: cita.texto.slice(0, 100), autor: cita.autor }
        }
        if (r.tipo === 'nota') {
          const nota = notasMap.get(r.itemId) as NotaConContenido | undefined
          if (!nota) return null
          const fragmento = nota.contenido?.slice(0, 120) ?? undefined
          return { ...r, itemId: nota.id, ...(fragmento ? { fragmento } : {}) }
        }
        if (r.tipo === 'documento') {
          const doc = docsMap.get(r.itemId)
          if (!doc) return null
          return { ...r, itemId: doc.id, autor: doc.autor }
        }
        return null
      })
      .filter((r): r is Recomendacion => r !== null)

    return NextResponse.json({
      analisis: parsed.analisis,
      recomendaciones,
      fragmentosIncluidos,
      ...(errorFragmentos ? { warningFragmentos: errorFragmentos } : {}),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
