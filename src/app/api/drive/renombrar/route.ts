import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, updateDocumentMetadata } from '@/lib/drive'
import type { Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

function construirNombre(doc: Documento): string | null {
  const apellido = doc.autor ? doc.autor.split(',')[0].trim() : null
  const año = doc.año?.match(/\d{4}/)?.[0] ?? null
  const titulo = doc.titulo?.trim() || null

  if (!apellido && !titulo) return null

  const norm = (s: string) =>
    s.normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // quitar tildes
      .replace(/[<>:"/\\|?*]/g, '')      // chars inválidos en nombres de archivo
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60)

  const partes: string[] = []
  if (apellido) partes.push(norm(apellido))
  if (año) partes.push(año)
  if (titulo) partes.push(norm(titulo))

  return partes.join('_') + '.pdf'
}

// GET — devuelve propuestas de renombrado sin aplicar
export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)

    const propuestas = documentos
      .map((doc) => {
        const nuevo = construirNombre(doc)
        if (!nuevo) return null
        const nombreActual = doc.nombre.split('/').pop() ?? doc.nombre
        if (nuevo.toLowerCase() === nombreActual.toLowerCase()) return null
        return { id: doc.id, nombreActual, nombrePropuesto: nuevo, autor: doc.autor, año: doc.año, titulo: doc.titulo ?? null }
      })
      .filter(Boolean)

    return NextResponse.json(propuestas)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST { ids: string[] } — aplica los renombres para los IDs indicados
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { ids } = (await req.json()) as { ids: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requieren IDs' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    const docMap = new Map(documentos.map(d => [d.id, d]))

    const resultados = await Promise.allSettled(
      ids.map(async (id) => {
        const doc = docMap.get(id)
        if (!doc) throw new Error(`Documento ${id} no encontrado`)
        const nuevo = construirNombre(doc)
        if (!nuevo) throw new Error(`Sin metadatos suficientes para ${id}`)
        await updateDocumentMetadata(accessToken, id, { nombre: nuevo })
        return { id, nombreNuevo: nuevo }
      })
    )

    const ok = resultados.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<{ id: string; nombreNuevo: string }>).value)
    const errores = resultados.filter(r => r.status === 'rejected').length

    return NextResponse.json({ ok: ok.length, errores, renombrados: ok })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
