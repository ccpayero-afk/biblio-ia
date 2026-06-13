import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Nota, TipoNota } from '@/types'
import { generarIdZettel } from '@/lib/zettel-id'
import { NextRequest, NextResponse } from 'next/server'

const NOMBRE = 'notas.json'

async function getNotasFileId(accessToken: string) {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, NOMBRE, estructura.notasId)
  return { estructura, fileId }
}

// Migra tipos legado a tipos Zettelkasten
function migrarTipo(tipo: string): TipoNota {
  if (tipo === 'ia') return 'referencia'
  if (tipo === 'manual') return 'efimera'
  if (tipo === 'ficha') return 'referencia'
  if (tipo === 'consulta') return 'efimera'
  return tipo as TipoNota
}

function normalizarNota(n: Nota): Nota {
  return {
    ...n,
    titulo: n.titulo ?? (n.contenido.split('\n')[0].slice(0, 80) || 'Sin título'),
    tipo: migrarTipo(n.tipo),
    vinculos: n.vinculos ?? [],
    etiquetas: n.etiquetas ?? [],
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileId } = await getNotasFileId(accessToken)
    if (!fileId) return NextResponse.json([])

    const notas = await readJSON<Nota[]>(accessToken, fileId)
    const tipo = req.nextUrl.searchParams.get('tipo')
    const q = req.nextUrl.searchParams.get('q')

    const incluirEliminadas = req.nextUrl.searchParams.get('incluir_eliminadas') === 'true'
    let resultado = notas.map(normalizarNota)
    if (!incluirEliminadas) resultado = resultado.filter((n) => !(n as Nota & { eliminadaEn?: string }).eliminadaEn)
    if (tipo) resultado = resultado.filter((n) => n.tipo === tipo)
    if (q) {
      const qLower = q.toLowerCase()
      resultado = resultado.filter(
        (n) =>
          n.titulo.toLowerCase().includes(qLower) ||
          n.contenido.toLowerCase().includes(qLower) ||
          n.etiquetas.some((e) => e.toLowerCase().includes(qLower))
      )
    }

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

    const { estructura, fileId } = await getNotasFileId(accessToken)
    let lista: Nota[] = []
    if (fileId) {
      try { lista = await readJSON<Nota[]>(accessToken, fileId) } catch { lista = [] }
    }

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
      // legado
      documentoId: body.documentoId,
      pagina: body.pagina,
      fragmentoTexto: body.fragmentoTexto,
    }

    lista.push(nuevaNota)
    await writeJSON(accessToken, estructura.notasId, NOMBRE, lista)
    return NextResponse.json(nuevaNota)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
