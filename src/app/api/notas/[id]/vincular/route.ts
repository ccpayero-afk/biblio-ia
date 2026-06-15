import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerIndice, escribirIndice, NotaLigera } from '@/lib/notas'
import { VinculoZettel } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

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

    const { notasId, indice } = await leerIndice(accessToken)
    const ahora = new Date().toISOString()

    const vinculo: VinculoZettel = {
      notaDestinoId: body.notaDestinoId,
      tipo: body.tipo,
      nota: body.nota,
      bidireccional: body.bidireccional !== false,
      creadoEn: ahora,
    }

    const origen = indice.find((n) => n.id === id)
    if (!origen) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    if (!origen.vinculos?.find((v) => v.notaDestinoId === body.notaDestinoId)) {
      origen.vinculos = [...(origen.vinculos ?? []), vinculo]
      origen.actualizadaEn = ahora
    }

    if (vinculo.bidireccional) {
      const destino = indice.find((n) => n.id === body.notaDestinoId)
      if (destino && !destino.vinculos?.find((v) => v.notaDestinoId === id)) {
        destino.vinculos = [...(destino.vinculos ?? []), { ...vinculo, notaDestinoId: id }]
        destino.actualizadaEn = ahora
      }
    }

    await escribirIndice(accessToken, notasId, indice)
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

    const { notasId, indice } = await leerIndice(accessToken)
    const ahora = new Date().toISOString()

    for (const nota of indice as (NotaLigera & { actualizadaEn?: string })[]) {
      if (nota.id === id || nota.id === destinoId) {
        const otroId = nota.id === id ? destinoId : id
        nota.vinculos = (nota.vinculos ?? []).filter((v) => v.notaDestinoId !== otroId)
        nota.actualizadaEn = ahora
      }
    }

    await escribirIndice(accessToken, notasId, indice)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
