import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, findFile, readJSON } from '@/lib/drive'
import { Cita, Nota, Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/buscar?q=query
// Búsqueda de texto en documentos, citas y notas (sin semántica, instantánea)
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.toLowerCase().trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ documentos: [], citas: [], notas: [] })
    }

    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const [documentos, citasRaw, notasRaw] = await Promise.all([
      listPDFs(accessToken, estructura.pdfsId),
      (async () => {
        const fid = await findFile(accessToken, 'citas.json', estructura.citasId)
        if (!fid) return []
        try { return await readJSON<Cita[]>(accessToken, fid) } catch { return [] }
      })(),
      (async () => {
        const fid = await findFile(accessToken, 'notas.json', estructura.notasId)
        if (!fid) return []
        try { return await readJSON<Nota[]>(accessToken, fid) } catch { return [] }
      })(),
    ])

    const docsFiltrados: Documento[] = documentos
      .filter((d) =>
        d.nombre.toLowerCase().includes(q) ||
        (d.autor ?? '').toLowerCase().includes(q) ||
        (d.abstract ?? '').toLowerCase().includes(q)
      )
      .slice(0, 6)

    const citasFiltradas: Cita[] = (citasRaw as Cita[])
      .filter((c) =>
        c.texto?.toLowerCase().includes(q) ||
        c.documentoNombre?.toLowerCase().includes(q) ||
        (c.notaPropia ?? '').toLowerCase().includes(q)
      )
      .slice(0, 6)

    const notasFiltradas: Nota[] = (notasRaw as Nota[])
      .filter((n) => n.contenido?.toLowerCase().includes(q))
      .slice(0, 6)

    return NextResponse.json({ documentos: docsFiltrados, citas: citasFiltradas, notas: notasFiltradas })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
