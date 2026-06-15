import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { cargarCurso, guardarCurso } from '@/lib/aula'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'

export interface PreguntaEvaluacion {
  id: string
  pregunta: string
  rubrica: string
}

export interface ResultadoEvaluacion {
  preguntaId: string
  puntaje: number
  feedback: string
  aciertos: string[]
  mejoras: string[]
}

// POST /api/aula/evaluar
// Body: { cursoId, moduloNumero }
// Returns: { preguntas: PreguntaEvaluacion[] }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { cursoId, moduloNumero, respuesta, preguntaId, rubrica } = await req.json() as {
      cursoId: string
      moduloNumero: number
      respuesta?: string
      preguntaId?: string
      rubrica?: string
    }

    const curso = await cargarCurso(accessToken, cursoId)
    const modulo = curso.plan.find((m) => m.numero === moduloNumero) ?? curso.plan[0]

    // Mode: generate questions
    if (!respuesta) {
      const result = await generateWithRotation(accessToken, async (genAI) => {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
        return model.generateContent(
          `Sos docente del módulo "${modulo.titulo}" del libro "${curso.libroTitulo}" de ${curso.libroAutor}.\n` +
          `Temas del módulo: ${modulo.temas.join(', ')}\n` +
          `Objetivos: ${modulo.objetivos.join('; ')}\n\n` +
          `Generá 4 preguntas de evaluación variadas (conceptual, aplicación, análisis, síntesis).\n` +
          `Respondé ÚNICAMENTE con JSON puro:\n` +
          `{"preguntas":[{"id":"q1","pregunta":"...","rubrica":"criterios de una respuesta completa en 1 oración"}]}`
        )
      })
      let txt = result.response.text().trim()
      if (txt.includes('```')) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
      const parsed = JSON.parse(txt)
      return NextResponse.json({ preguntas: parsed.preguntas ?? [] })
    }

    // Mode: correct an answer
    const result = await generateWithRotation(accessToken, async (genAI) => {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
      return model.generateContent(
        `Sos docente evaluador del módulo "${modulo.titulo}" del libro "${curso.libroTitulo}".\n\n` +
        `Pregunta evaluada: "${preguntaId}"\n` +
        `Rúbrica: ${rubrica}\n\n` +
        `Respuesta del estudiante: "${respuesta}"\n\n` +
        `Evaluá la respuesta con criterio pedagógico constructivo.\n` +
        `Respondé ÚNICAMENTE con JSON puro:\n` +
        `{"puntaje":7,"feedback":"comentario general en 2 oraciones","aciertos":["lo que hizo bien"],"mejoras":["lo que puede mejorar"]}\n` +
        `Puntaje del 1 al 10.`
      )
    })
    let txt = result.response.text().trim()
    if (txt.includes('```')) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)
    const correccion = JSON.parse(txt) as ResultadoEvaluacion

    // Save evaluation score to curso metadata
    const evaluaciones = { ...(curso.evaluaciones ?? {}) }
    const key = `m${moduloNumero}`
    evaluaciones[key] = [...(evaluaciones[key] ?? []), correccion.puntaje]
    await guardarCurso(accessToken, { ...curso, evaluaciones }, cursoId)

    return NextResponse.json({ ...correccion, preguntaId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
