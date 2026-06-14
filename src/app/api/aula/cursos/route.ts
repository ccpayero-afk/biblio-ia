import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { listarCursos, guardarCurso, getSampleChunks } from '@/lib/aula'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import type { Curso } from '@/types'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const cursos = await listarCursos(accessToken)
    return NextResponse.json(cursos)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const { libroId, libroNombre, libroTitulo, libroAutor } = await req.json() as {
      libroId: string
      libroNombre: string
      libroTitulo?: string
      libroAutor?: string
    }

    if (!libroId) return NextResponse.json({ error: 'Falta libroId' }, { status: 400 })

    const estructura = await initUserDrive(accessToken)
    const chunks = await getSampleChunks(accessToken, libroId, estructura.indexId)

    const titulo = libroTitulo || libroNombre.replace(/\.pdf$/i, '')
    const autor = libroAutor || 'autor desconocido'
    const contexto = chunks.length
      ? `\nExtractos del libro para contexto:\n${chunks.slice(0, 10).join('\n---\n')}`
      : ''

    const prompt = `Eres un diseñador pedagógico experto. Creá un plan de estudios completo para el libro "${titulo}" de ${autor}.${contexto}

Generá entre 6 y 10 módulos temáticos según la complejidad del libro. Para cada módulo incluí:
- numero: número secuencial (entero, comenzando en 1)
- titulo: título descriptivo y conciso del módulo
- descripcion: descripción de 2-3 oraciones sobre qué cubre el módulo
- objetivos: lista de 3-4 objetivos de aprendizaje específicos y medibles
- temas: lista de 5-8 conceptos o temas clave del módulo

Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto adicional. Formato exacto:
[{"numero":1,"titulo":"...","descripcion":"...","objetivos":["..."],"temas":["..."]}]`

    let plan
    try {
      const texto = await generateWithRotation(accessToken, async (genAI) => {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
        const result = await model.generateContent(prompt)
        return result.response.text().trim()
      })
      const jsonText = texto.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      plan = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: 'No se pudo generar el plan de estudios. Intentá de nuevo.' }, { status: 500 })
    }

    const ahora = new Date().toISOString()
    const curso: Curso = {
      libroId,
      libroNombre,
      libroTitulo: titulo,
      libroAutor: autor,
      plan,
      moduloActual: 1,
      conversacion: [],
      creadoEn: ahora,
      actualizadoEn: ahora,
    }

    const fileId = await guardarCurso(accessToken, curso)
    return NextResponse.json({ id: fileId, ...curso })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
