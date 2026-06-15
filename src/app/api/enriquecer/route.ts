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
  tipo: 'cita' | 'nota' | 'documento' | 'fragmento'
  itemId: string        // docId para documento/fragmento, id real para cita/nota
  titulo: string
  autor?: string
  pagina?: number       // solo para fragmento
  parrafo: string
  razon: string
  relevancia: 'alta' | 'media'
  fragmento?: string
}

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

    const textoLimitado = texto.slice(0, 6000)

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
    const fragmentosMap = new Map<string, { documentoId: string; pagina: number; texto: string }>()
    const partes: string[] = []

    type NotaConContenido = NotaLigera & { contenido?: string }

    // Citas — ordenadas por relevancia al texto
    const citasOrdenadas = [...citas]
      .map((c) => ({ c, score: scoreRelevancia(`${c.texto} ${c.etiquetas.join(' ')}`, queryTerms) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
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
        score: scoreRelevancia(`${n.titulo} ${n.contenido ?? ''} ${n.etiquetas.join(' ')}`, queryTerms),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.n)

    if (notasOrdenadas.length > 0) {
      partes.push('\n=== NOTAS PERSONALES ===')
      notasOrdenadas.forEach((n, i) => {
        const key = `n${i + 1}`
        notasMap.set(key, n)
        const etiq = n.etiquetas?.length ? ` [${n.etiquetas.join(', ')}]` : ''
        const snippet = n.contenido
          ? ` — "${n.contenido.slice(0, 120).replace(/\n/g, ' ')}"`
          : n.comentarioPersonal ? ` — "${n.comentarioPersonal.slice(0, 80)}"` : ''
        partes.push(`[${key}] "${n.titulo}"${etiq}${snippet}`)
      })
    }

    // Documentos — todos en scope, ordenados por relevancia
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

    // Búsqueda semántica sobre todos los docs indexados en scope → claves f1, f2, ...
    const docIdsIndexados = documentos.filter((d) => d.estado === 'indexado').map((d) => d.id)
    let fragmentosIncluidos = 0
    let errorFragmentos: string | null = null

    if (docIdsIndexados.length > 0) {
      try {
        const fragmentos = await semanticSearch(textoLimitado.slice(0, 1500), accessToken, {
          documentoIds: docIdsIndexados,
          topK: 8,
        })
        if (fragmentos.length > 0) {
          partes.push('\n=== PASAJES DE DOCUMENTOS (para recomendaciones de lectura específica) ===')
          fragmentos.forEach((f, i) => {
            const key = `f${i + 1}`
            fragmentosMap.set(key, { documentoId: f.documentoId, pagina: f.pagina, texto: f.texto })

            // Encontrar la clave del doc en el catálogo para que Gemini entienda a qué doc pertenece
            const docIdx = docsOrdenados.findIndex((d) => d.id === f.documentoId)
            let docRef: string
            if (docIdx >= 0) {
              docRef = `d${docIdx + 1}`
            } else {
              // Doc indexado pero no en el catálogo — agregar al docsMap con clave propia
              const docExtra = documentos.find((d) => d.id === f.documentoId)
              if (!docExtra) return
              const extraKey = `d${docsMap.size + 1}`
              docsMap.set(extraKey, docExtra)
              docRef = extraKey
            }

            const titulo = documentos.find((d) => d.id === f.documentoId)
            const tituloStr = titulo?.titulo || titulo?.nombre.replace(/\.pdf$/i, '') || f.documentoNombre
            const snip = f.texto.slice(0, 250).replace(/\n/g, ' ')
            partes.push(`[${key}] "${tituloStr}" p.${f.pagina} (doc: ${docRef}): "${snip}"`)
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
        analisis: 'Tu biblioteca está vacía. Importá documentos, guardá citas o creá notas para poder hacer recomendaciones.',
        recomendaciones: [],
        fragmentosIncluidos: 0,
      })
    }

    const prompt =
      `Sos un asistente de investigación académica. Analizá el texto del usuario e identificá qué recursos de su biblioteca personal complementan, apoyan o enriquecen ese texto.\n\n` +
      `TEXTO A ANALIZAR:\n${textoLimitado}\n\n` +
      `BIBLIOTECA DEL USUARIO:\n${catalogo}\n\n` +
      `Instrucciones:\n` +
      `- Todos los recursos ya están pre-ordenados por relevancia al texto\n` +
      `- Identificá los temas, argumentos y conceptos centrales del texto\n` +
      `- TIPOS DE RECOMENDACIÓN disponibles:\n` +
      `  * tipo:"cita" — cita guardada (itemId: c1, c2...)\n` +
      `  * tipo:"nota" — nota personal (itemId: n1, n2...)\n` +
      `  * tipo:"documento" — recomendar leer un documento completo (itemId: d1, d2...)\n` +
      `  * tipo:"fragmento" — recomendar un PASAJE ESPECÍFICO de un documento con número de página (itemId: f1, f2...) — PREFERIR ESTE TIPO cuando el contenido real del pasaje es relevante\n` +
      `- Si hay PASAJES DE DOCUMENTOS relevantes, SIEMPRE incluílos como tipo:"fragmento"\n` +
      `- Combiná los tipos: no solo citas, incluí también fragmentos y documentos cuando aporten\n` +
      `- Priorizá por relevancia real: 5-10 recomendaciones en total\n\n` +
      `Respondé ÚNICAMENTE con JSON puro:\n` +
      `{"analisis":"2-3 oraciones sobre los temas del texto y qué complementos necesita","recomendaciones":[{"tipo":"fragmento","itemId":"f1","titulo":"título del documento","autor":"apellido","parrafo":"frase del texto del usuario que justifica esta recomendación","razon":"por qué este pasaje complementa ese punto (1-2 oraciones con algo concreto del texto del pasaje)","relevancia":"alta"}]}`

    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      })
    })

    let txt = result.response.text().trim()
    // Extraer el objeto JSON aunque haya texto antes o después
    const jsonStart = txt.indexOf('{')
    const jsonEnd = txt.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error(`Gemini no devolvió JSON válido. Respuesta: "${txt.slice(0, 200)}"`)
    }
    txt = txt.slice(jsonStart, jsonEnd + 1)
    const parsed = JSON.parse(txt) as {
      analisis: string
      recomendaciones: Array<Recomendacion & { itemId: string }>
    }

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
        if (r.tipo === 'fragmento') {
          const frag = fragmentosMap.get(r.itemId)
          if (!frag) return null
          const doc = documentos.find((d) => d.id === frag.documentoId)
          return {
            ...r,
            itemId: frag.documentoId,
            autor: doc?.autor,
            pagina: frag.pagina,
            fragmento: frag.texto.slice(0, 150),
          }
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
