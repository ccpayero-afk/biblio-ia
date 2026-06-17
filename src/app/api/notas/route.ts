'use server'

import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { Nota, TipoNota } from '@/types'
import { generarIdZettel } from '@/lib/zettel-id'
import { leerIndice, aLigera, escribirIndice, escribirContenido, NotaLigera } from '@/lib/notas'
import { guardarEmbeddingNota } from '@/lib/notas-emb'
import { NextRequest, NextResponse } from 'next/server'

function migrarTipo(tipo: string): TipoNota {
  if (tipo === 'ia') return 'referencia'
  if (tipo === 'manual') return 'efimera'
  if (tipo === 'ficha') return 'referencia'
  if (tipo === 'consulta') return 'efimera'
  return tipo as TipoNota
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { indice } = await leerIndice(accessToken)

    const tipo = req.nextUrl.searchParams.get('tipo')
    const q = req.nextUrl.searchParams.get('q')?.toLowerCase()
    const incluirEliminadas = req.nextUrl.searchParams.get('incluir_eliminadas') === 'true'

    let resultado = indice.map((n) => ({
      ...n,
      titulo: n.titulo ?? 'Sin título',
      tipo: migrarTipo(n.tipo),
      vinculos: n.vinculos ?? [],
      etiquetas: n.etiquetas ?? [],
    }))

    if (!incluirEliminadas)
      resultado = resultado.filter(
        (n) => !(n as typeof n & { eliminadaEn?: string }).eliminadaEn
      )
    if (tipo) resultado = resultado.filter((n) => n.tipo === tipo)
    if (q)
      resultado = resultado.filter(
        (n) =>
          n.titulo.toLowerCase().includes(q) ||
          n.etiquetas.some((e) => e.toLowerCase().includes(q))
      )

    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const body = await req.json()

    const { notasId, indice } = await leerIndice(accessToken)
    const ahora = new Date().toISOString()

    const nuevaNota: Nota = {
      id: body.id ?? generarIdZettel(),
      titulo: body.titulo ?? body.contenido?.split('\n')[0].slice(0, 80) ?? 'Sin título',
      contenido: body.contenido ?? '',
      tipo: body.tipo ?? 'efimera',
      vinculos: body.vinculos ?? [],
      etiquetas: body.etiquetas ?? [],
      documentoOrigenId: body.documentoOrigenId ?? body.documentoId,
      paginaOrigen: body.paginaOrigen ?? body.pagina,
      citaOrigenId: body.citaOrigenId,
      creadaEn: body.creadaEn ?? ahora,
      actualizadaEn: ahora,
      documentoId: body.documentoId,
      pagina: body.pagina,
      fragmentoTexto: body.fragmentoTexto,
    }

    await Promise.all([
      escribirContenido(accessToken, notasId, nuevaNota.id, {
        contenido: nuevaNota.contenido,
        versiones: [],
      }),
      escribirIndice(accessToken, notasId, [
        ...indice,
        { ...aLigera(nuevaNota), contenido: nuevaNota.contenido } as unknown as NotaLigera,
      ]),
    ])

    // Fire-and-forget: generate semantic embedding for future vinculos suggestions
    if (nuevaNota.tipo !== 'efimera') {
      guardarEmbeddingNota(accessToken, nuevaNota.id, nuevaNota.titulo, nuevaNota.contenido).catch(() => {})
    }

    return NextResponse.json(nuevaNota)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
