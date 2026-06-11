import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { downloadPDFBuffer } from '@/lib/indexer'
import { extraerMetadatos } from '@/lib/metadatos'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)

    // `forzar=true` → sobrescribe todos los campos extraídos aunque ya tengan valor
    const body = await req.json().catch(() => ({}))
    const forzar = body.forzar === true

    const buffer = await downloadPDFBuffer(accessToken, documentoId)
    const metadatos = await extraerMetadatos(buffer)

    const actualizados: string[] = []
    const updates: Parameters<typeof updateDocumentMetadata>[2] = {}

    function set<K extends keyof typeof updates>(campo: K, valor: (typeof updates)[K], nombre: string) {
      if (valor !== undefined && valor !== '') {
        updates[campo] = valor
        actualizados.push(nombre)
      }
    }

    if (forzar) {
      // Sobrescribir todo lo que se extrajo
      set('titulo', metadatos.titulo?.trim() || undefined, 'titulo')
      set('autor', metadatos.autor?.trim() || undefined, 'autor')
      set('año', metadatos.año?.trim() || undefined, 'año')
      set('tipo', metadatos.tipo, 'tipo')
      set('revista', metadatos.revista?.trim() || undefined, 'revista')
      set('editorial', metadatos.editorial?.trim() || undefined, 'editorial')
      set('volumen', metadatos.volumen?.trim() || undefined, 'volumen')
      set('numero', metadatos.numero?.trim() || undefined, 'numero')
      set('paginas', metadatos.paginas?.trim() || undefined, 'paginas')
      set('url', metadatos.url?.trim() || undefined, 'url')
      set('doi', metadatos.doi?.trim() || undefined, 'doi')
      set('isbn', metadatos.isbn?.trim() || undefined, 'isbn')
      set('abstract', metadatos.abstract?.trim() || undefined, 'abstract')
    } else {
      // Solo guardar campos que tengan valor extraído (no vacíos)
      if (metadatos.titulo?.trim()) { updates.titulo = metadatos.titulo.trim(); actualizados.push('titulo') }
      if (metadatos.autor?.trim())  { updates.autor  = metadatos.autor.trim();  actualizados.push('autor') }
      if (metadatos.año?.trim())    { updates.año    = metadatos.año.trim();    actualizados.push('año') }
      if (metadatos.tipo)           { updates.tipo   = metadatos.tipo;          actualizados.push('tipo') }
      if (metadatos.revista?.trim()) { updates.revista = metadatos.revista.trim(); actualizados.push('revista') }
      if (metadatos.editorial?.trim()) { updates.editorial = metadatos.editorial.trim(); actualizados.push('editorial') }
      if (metadatos.volumen?.trim()) { updates.volumen = metadatos.volumen.trim(); actualizados.push('volumen') }
      if (metadatos.numero?.trim())  { updates.numero  = metadatos.numero.trim();  actualizados.push('numero') }
      if (metadatos.paginas?.trim()) { updates.paginas  = metadatos.paginas.trim(); actualizados.push('paginas') }
      if (metadatos.url?.trim())     { updates.url = metadatos.url.trim();          actualizados.push('url') }
      if (metadatos.doi?.trim())     { updates.doi = metadatos.doi.trim();          actualizados.push('doi') }
      if (metadatos.isbn?.trim())    { updates.isbn = metadatos.isbn.trim();        actualizados.push('isbn') }
      if (metadatos.abstract?.trim()) { updates.abstract = metadatos.abstract.trim(); actualizados.push('abstract') }
    }

    if (actualizados.length > 0) {
      await updateDocumentMetadata(accessToken, documentoId, updates)
    }

    return NextResponse.json({ ok: true, metadatos, actualizados, fuente: metadatos.fuente })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
