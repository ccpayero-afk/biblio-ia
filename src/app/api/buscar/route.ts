import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, findFile, readJSON } from '@/lib/drive'
import { leerIndice, NotaLigera } from '@/lib/notas'
import { Cita, Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

function norm(str: string): string {
  return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// GET /api/buscar?q=query
// Full-text search across docs, citas and the lean notes index (title + etiquetas).
// Pre-migration entries that still have inline contenido are also searched.
export async function GET(req: NextRequest) {
  try {
    const q = norm(req.nextUrl.searchParams.get('q') ?? '').trim()
    const carpetaId = req.nextUrl.searchParams.get('carpetaId') ?? ''
    if (!q || q.length < 2) {
      return NextResponse.json({ documentos: [], citas: [], notas: [] })
    }

    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const [documentos, citasRaw, { indice }] = await Promise.all([
      listPDFs(accessToken, estructura.pdfsId),
      (async () => {
        const fid = await findFile(accessToken, 'citas.json', estructura.citasId)
        if (!fid) return [] as Cita[]
        try { return await readJSON<Cita[]>(accessToken, fid) } catch { return [] as Cita[] }
      })(),
      leerIndice(accessToken),
    ])

    const docsFiltrados: Documento[] = documentos
      .filter((d) =>
        (!carpetaId || d.carpetaId === carpetaId) &&
        (
          norm(d.nombre).includes(q) ||
          norm(d.titulo ?? '').includes(q) ||
          norm(d.autor ?? '').includes(q) ||
          norm(d.abstract ?? '').includes(q)
        )
      )
      .slice(0, 6)

    const citasFiltradas: Cita[] = citasRaw
      .filter((c) =>
        norm(c.texto ?? '').includes(q) ||
        norm(c.documentoNombre ?? '').includes(q) ||
        norm(c.autor ?? '').includes(q) ||
        norm(c.notaPropia ?? '').includes(q)
      )
      .slice(0, 6)

    type NotaIndexEntry = NotaLigera & { contenido?: string; eliminadaEn?: string }
    const notasFiltradas = (indice as NotaIndexEntry[])
      .filter((n) => {
        if (n.eliminadaEn) return false
        return (
          norm(n.titulo ?? '').includes(q) ||
          (n.etiquetas ?? []).some((e) => norm(e).includes(q)) ||
          norm(n.contenido ?? '').includes(q) // legacy inline contenido
        )
      })
      .slice(0, 6)

    return NextResponse.json({ documentos: docsFiltrados, citas: citasFiltradas, notas: notasFiltradas })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
