import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { leerTodasCompletas } from '@/lib/notas'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from '@/lib/gemini'
import { Proyecto, Cita, Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { seccionId } = await req.json()

    const estructura = await initUserDrive(accessToken)

    // Load project
    const proyFileId = await findFile(accessToken, 'proyectos.json', estructura.proyectosId)
    if (!proyFileId) return NextResponse.json({ error: 'No hay proyectos' }, { status: 404 })
    const proyectos = await readJSON<Proyecto[]>(accessToken, proyFileId)
    const proyecto = proyectos.find((p) => p.id === id)
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const seccion = proyecto.secciones.find((s) => s.id === seccionId)
    if (!seccion) return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })

    // Load assigned citas
    let citasTexto = ''
    if (proyecto.citasVinculadas.length || seccion.citasAsignadas.length) {
      const citasIds = new Set([...proyecto.citasVinculadas, ...seccion.citasAsignadas])
      const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
      if (citasFileId) {
        const todasCitas = await readJSON<Cita[]>(accessToken, citasFileId)
        const citasFiltradas = todasCitas.filter((c) => citasIds.has(c.id))
        citasTexto = citasFiltradas
          .map((c) => `[${c.formatoAPA}]: "${c.texto}"`)
          .join('\n')
      }
    }

    // Load relevant notas
    let notasTexto = ''
    if (proyecto.notasVinculadas.length) {
      const notasIds = new Set(proyecto.notasVinculadas)
      const todasNotas = await leerTodasCompletas(accessToken).catch(() => [] as Nota[])
      notasTexto = todasNotas
        .filter((n) => notasIds.has(n.id))
        .map((n) => n.contenido)
        .join('\n\n')
    }

    const prompt = `Redactá un borrador académico para la siguiente sección de un ${proyecto.tipo}.

PROYECTO: "${proyecto.nombre}"
ARGUMENTO CENTRAL DEL PROYECTO: ${proyecto.argumentoCentral}

SECCIÓN: "${seccion.titulo}"
ARGUMENTO DE ESTA SECCIÓN: ${seccion.argumento}

${citasTexto ? `CITAS DISPONIBLES PARA USAR:\n${citasTexto}\n` : ''}
${notasTexto ? `NOTAS DE INVESTIGACIÓN:\n${notasTexto}\n` : ''}

Escribí un borrador de 300-500 palabras para esta sección en español académico.
Integrá las citas disponibles usando el formato (Autor, Año, p. N) donde corresponda.
No uses viñetas. Escribí en prosa académica fluida.
Respondé ÚNICAMENTE con el texto del borrador, sin título ni introducción.`

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const result = await generateWithRotation(accessToken, async (genAI) => {
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
            return model.generateContentStream(prompt)
          })
          let borrador = ''
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              borrador += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: text })}\n\n`))
            }
          }

          // Save borrador to project
          const idx = proyecto.secciones.findIndex((s) => s.id === seccionId)
          if (idx !== -1) {
            proyecto.secciones[idx].borrador = borrador
            proyecto.actualizadoEn = new Date().toISOString()
            const nuevaLista = proyectos.map((p) => (p.id === id ? proyecto : p))
            await writeJSON(accessToken, estructura.proyectosId, 'proyectos.json', nuevaLista)
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
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
