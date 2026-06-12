import { NextRequest, NextResponse } from 'next/server'

// GET /api/crossref?doi=10.xxxx/xxxx
// GET /api/crossref?titulo=Some+Title
export async function GET(req: NextRequest) {
  try {
    const doi   = req.nextUrl.searchParams.get('doi')?.trim()
    const titulo = req.nextUrl.searchParams.get('titulo')?.trim()

    if (!doi && !titulo) {
      return NextResponse.json({ error: 'Se requiere doi o titulo' }, { status: 400 })
    }

    const crUrl = doi
      ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
      : `https://api.crossref.org/works?query.title=${encodeURIComponent(titulo!)}&rows=1`

    const res = await fetch(crUrl, {
      headers: { 'User-Agent': 'BiblioIA/1.0 (mailto:payero.cristian@gmail.com)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `CrossRef: ${res.status}` }, { status: res.status })
    }

    const json = await res.json()

    // Extraer el item correcto según si buscamos por DOI o por título
    let item: Record<string, unknown>
    if (doi) {
      item = json.message as Record<string, unknown>
    } else {
      const items = (json.message as { items?: Record<string, unknown>[] })?.items
      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'Sin resultados en CrossRef' }, { status: 404 })
      }
      item = items[0]
    }

    // Título
    const tituloRes = (
      Array.isArray(item.title) ? (item.title as string[])[0] : item.title
    ) as string | undefined

    // Autores: family, given → "Apellido, N."
    type Author = { family?: string; given?: string; name?: string }
    const authors = item.author as Author[] | undefined
    const autorRes = authors
      ?.map((a) => {
        if (a.name) return a.name
        const parts = [a.family, a.given ? a.given.charAt(0) + '.' : undefined].filter(Boolean)
        return parts.join(', ')
      })
      .join('; ')

    // Año de publicación
    type DateParts = { 'date-parts'?: number[][] }
    const published = (item['published-print'] ?? item['published-online'] ?? item['published']) as DateParts | undefined
    const añoRes = published?.['date-parts']?.[0]?.[0]?.toString()

    // Revista / editorial
    const containerTitle = (
      Array.isArray(item['container-title'])
        ? (item['container-title'] as string[])[0]
        : item['container-title']
    ) as string | undefined

    // Tipo
    const type = item.type as string | undefined
    let tipo: 'articulo' | 'libro' | 'capitulo' | 'tesis' | 'otro' = 'otro'
    if (type === 'journal-article') tipo = 'articulo'
    else if (type === 'book' || type === 'monograph') tipo = 'libro'
    else if (type === 'book-chapter') tipo = 'capitulo'
    else if (type === 'dissertation') tipo = 'tesis'

    // Abstract: CrossRef usa JATS XML, limpiar etiquetas
    const abstractRaw = item.abstract as string | undefined
    const abstractRes = abstractRaw?.replace(/<[^>]+>/g, '').trim()

    return NextResponse.json({
      titulo:    tituloRes || undefined,
      autor:     autorRes  || undefined,
      año:       añoRes    || undefined,
      tipo,
      revista:   containerTitle                          || undefined,
      editorial: item.publisher   as string | undefined,
      volumen:   item.volume      as string | undefined,
      numero:    item.issue       as string | undefined,
      paginas:   item.page        as string | undefined,
      url:       item.URL         as string | undefined,
      doi:       item.DOI         as string | undefined,
      abstract:  abstractRes      || undefined,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
