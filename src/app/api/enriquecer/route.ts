import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice } from '@/lib/notas'
import { leerCitas } from '@/lib/citas'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { texto, carpetasIds } = (await req.json()) as { texto: string; carpetasIds?: string[] }

    if (!texto?.trim()) return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })

    const textoLimitado = texto.slice(0, 12000)

    const [{ indice }, { citas }, estructura] = await Promise.all([
      leerIndice(accessToken),
      leerCitas(accessToken),
      initUserDrive(accessToken),
    ])
    const todosLosDocumentos = await listPDFs(accessToken, estructura.pdfsId)
    const documentos = carpetasIds?.length
      ? todosLosDocumentos.filter((d) => carpetasIds.includes(d.carpetaId ?? ''))
      : todosLosDocumentos

    // Build indexed catalog maps  (short keys → real objects)
    const citasMap = new Map<string, Cita>()
    const notasMap = new Map<string, NotaLigera>()
    const docsMap = new Map<string, Documento>()
    const partes: string[] = []

    const citasRecientes = citas.slice(0, 50)
    if (citasRecientes.length > 0) {
      partes.push('=== CITAS GUARDADAS ===')
      citasRecientes.forEach((c, i) => {
        const key = `c${i + 1}`
        citasMap.set(key, c)
        const etiq = c.etiquetas?.length ? ` [${c.etiquetas.join(', ')}]` : ''
        partes.push(`[${key}] "${c.texto.slice(0, 130)}" — ${c.formatoAPA}${etiq}`)
      })
    }

    type NotaConContenido = NotaLigera & { contenido?: string }
    const notasRecientes = (indice as NotaConContenido[])
      .filter((n) => n.tipo !== 'efimera')
      .slice(0, 40)
    if (notasRecientes.length > 0) {
      partes.push('\n=== NOTAS PERSONALES ===')
      notasRecientes.forEach((n, i) => {
        const key = `n${i + 1}`
        notasMap.set(key, n)
        const etiq = n.etiquetas?.length ? ` [${n.etiquetas.join(', ')}]` : ''
        const snippet = n.contenido
          ? ` — "${n.contenido.slice(0, 100).replace(/\n/g, ' ')}"`
          : n.comentarioPersonal ? ` — "${n.comentarioPersonal.slice(0, 60)}"` : ''
        partes.push(`[${key}] "${n.titulo}"${etiq}${snippet}`)
      })
    }

    if (documentos.length > 0) {
      partes.push('\n=== DOCUMENTOS EN BIBLIOTECA ===')
      documentos.slice(0, 40).forEach((d, i) => {
        const key = `d${i + 1}`
        docsMap.set(key, d)
        const info = [d.titulo || d.nombre.replace(/\.pdf$/i, ''), d.autor, d.año]
          .filter(Boolean)
          .join(' — ')
        partes.push(`[${key}] ${info}`)
      })
    }

    const catalogo = partes.join('\n')

    if (!catalogo.trim()) {
      return NextResponse.json({
        analisis:
          'Tu biblioteca está vacía. Importá documentos, guardá citas o creá notas para poder hacer recomendaciones.',
        recomendaciones: [],
      })
    }

    const prompt =
      `Sos un asistente de investigación académica. Analizá el texto del usuario e identificá qué recursos de su biblioteca personal complementan, apoyan o enriquecen ese texto.\n\n` +
      `TEXTO A ANALIZAR:\n${textoLimitado}\n\n` +
      `BIBLIOTECA DEL USUARIO:\n${catalogo}\n\n` +
      `Instrucciones:\n` +
      `- Identificá los temas, argumentos y conceptos centrales del texto\n` +
      `- Relacioná cada recurso relevante con una parte específica del texto\n` +
      `- Priorizá por relevancia real: 3-10 recomendaciones en total\n` +
      `- Si un recurso no aporta concretamente, no lo incluyas\n\n` +
      `Respondé ÚNICAMENTE con JSON puro:\n` +
      `{"analisis":"2-3 oraciones sobre los temas del texto y qué tipo de complemento necesita","recomendaciones":[{"tipo":"cita","itemId":"c1","titulo":"título breve","autor":"apellido si aplica","parrafo":"frase del texto del usuario que justifica esta recomendación","razon":"por qué este recurso complementa esa parte (1-2 oraciones)","relevancia":"alta","fragmento":"primeras palabras del recurso (máx 80 chars)"}]}`

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

    return NextResponse.json({ analisis: parsed.analisis, recomendaciones })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
