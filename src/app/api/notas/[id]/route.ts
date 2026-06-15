import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { Nota, NotaVersion } from '@/types'
import {
  leerIndice, leerContenido, leerNota, aLigera,
  escribirIndice, escribirContenido, eliminarArchivoContenido, NotaLigera,
} from '@/lib/notas'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const nota = await leerNota(accessToken, id)
    if (!nota) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(nota)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params
    const body = await req.json()

    const { notasId, indice } = await leerIndice(accessToken)
    const idx = indice.findIndex((n) => n.id === id)
    if (idx === -1) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Restore action: undelete from index only
    if (body.action === 'restore') {
      delete (indice[idx] as NotaLigera & { eliminadaEn?: string }).eliminadaEn
      await escribirIndice(accessToken, notasId, indice)
      return NextResponse.json(indice[idx])
    }

    // Read current content for version snapshot
    const entryActual = indice[idx] as NotaLigera & { contenido?: string; versiones?: NotaVersion[] }
    const contenidoActual = await leerContenido(accessToken, notasId, id, entryActual)

    const snapshot: NotaVersion = {
      contenido: contenidoActual.contenido,
      titulo: indice[idx].titulo,
      guardadaEn: indice[idx].actualizadaEn ?? new Date().toISOString(),
    }
    const newVersiones = [snapshot, ...contenidoActual.versiones].slice(0, 5)
    const newContenido = body.contenido ?? contenidoActual.contenido
    const ahora = new Date().toISOString()

    const notaActualizada = { ...indice[idx], ...body, id, actualizadaEn: ahora }
    indice[idx] = { ...aLigera(notaActualizada as Nota), contenido: newContenido } as unknown as NotaLigera

    await Promise.all([
      escribirIndice(accessToken, notasId, indice),
      escribirContenido(accessToken, notasId, id, {
        contenido: newContenido,
        versiones: newVersiones,
      }),
    ])

    return NextResponse.json({ ...indice[idx], contenido: newContenido, versiones: newVersiones })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    const { notasId, indice } = await leerIndice(accessToken)
    const idx = indice.findIndex((n) => n.id === id)
    if (idx === -1) return NextResponse.json({ ok: true })

    const entry = indice[idx] as NotaLigera & { eliminadaEn?: string }

    if (!entry.eliminadaEn) {
      // Soft delete: mark in index only
      entry.eliminadaEn = new Date().toISOString()
      await escribirIndice(accessToken, notasId, indice)
      return NextResponse.json({ ok: true, soft: true })
    }

    // Hard delete: remove from index + delete content file + clean vinculos in other entries
    const nuevaLista = indice
      .filter((n) => n.id !== id)
      .map((n) => ({ ...n, vinculos: (n.vinculos ?? []).filter((v) => v.notaDestinoId !== id) }))

    await Promise.all([
      escribirIndice(accessToken, notasId, nuevaLista),
      eliminarArchivoContenido(accessToken, notasId, id),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
