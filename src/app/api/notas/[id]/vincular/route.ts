import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Nota, VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'notas.json'

async function getYGuardar(
  accessToken: string,
  mutate: (lista: Nota[]) => void
): Promise<Nota[]> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  let lista: Nota[] = []
  if (fileId) {
    try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
  }
  mutate(lista)
  await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
  return lista
}

// POST — body: { notaDestinoId, tipo, nota?, bidireccional? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const body = await req.json()

    if (!body.notaDestinoId || !body.tipo) {
      return NextResponse.json({ error: 'notaDestinoId y tipo son requeridos' }, { status: 400 })
    }

    const vinculo: VinculoZettel = {
      notaDestinoId: body.notaDestinoId,
      tipo: body.tipo,
      nota: body.nota,
      bidireccional: body.bidireccional !== false,
      creadoEn: new Date().toISOString(),
    }

    await getYGuardar(accessToken, (lista) => {
      const origen = lista.find((n) => n.id === id)
      if (!origen) return
      origen.vinculos = origen.vinculos ?? []
      if (!origen.vinculos.find((v) => v.notaDestinoId === body.notaDestinoId)) {
        origen.vinculos.push(vinculo)
        origen.actualizadaEn = new Date().toISOString()
      }

      // Vínculo inverso si es bidireccional
      if (vinculo.bidireccional) {
        const destino = lista.find((n) => n.id === body.notaDestinoId)
        if (destino) {
          destino.vinculos = destino.vinculos ?? []
          if (!destino.vinculos.find((v) => v.notaDestinoId === id)) {
            destino.vinculos.push({ ...vinculo, notaDestinoId: id })
            destino.actualizadaEn = new Date().toISOString()
          }
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/notas/[id]/vincular?destinoId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const destinoId = req.nextUrl.searchParams.get('destinoId')
    if (!destinoId) return NextResponse.json({ error: 'destinoId requerido' }, { status: 400 })

    await getYGuardar(accessToken, (lista) => {
      for (const nota of lista) {
        if (nota.id === id || nota.id === destinoId) {
          const otroId = nota.id === id ? destinoId : id
          nota.vinculos = (nota.vinculos ?? []).filter((v) => v.notaDestinoId !== otroId)
          nota.actualizadaEn = new Date().toISOString()
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
