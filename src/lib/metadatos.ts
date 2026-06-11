import { getDocumentProxy } from 'unpdf'

export interface MetadatosExtraidos {
  titulo?: string
  autor?: string
  año?: string
  tipo?: 'articulo' | 'libro' | 'capitulo' | 'tesis' | 'otro'
  revista?: string
  editorial?: string
  volumen?: string
  numero?: string
  paginas?: string
  url?: string
  doi?: string
  isbn?: string
  abstract?: string
  palabrasClave?: string[]
  fuente: 'pdf' | 'crossref' | 'openlibrary'
}

function extraerDOI(texto: string): string | null {
  const match = texto.match(/\b(10\.\d{4,}\/[^\s\]\[,;:)("'\n]+)/i)
  if (!match) return null
  return match[1].replace(/[.),:;'"]+$/, '')
}

function extraerISBN(texto: string): string | null {
  const match = texto.match(/(?:isbn[-:. ]?)((?:97[89][-. ]?)?(?:\d[-. ]?){9}[\dX])/i)
  if (!match) return null
  return match[1].replace(/[-. ]/g, '')
}

function mapearTipoCrossRef(type: string): MetadatosExtraidos['tipo'] {
  if (['journal-article', 'proceedings-article', 'posted-content'].includes(type)) return 'articulo'
  if (['book', 'monograph', 'reference-book', 'edited-book'].includes(type)) return 'libro'
  if (['book-chapter', 'book-section', 'book-part', 'reference-entry'].includes(type)) return 'capitulo'
  if (['dissertation', 'thesis'].includes(type)) return 'tesis'
  return 'otro'
}

async function buscarEnCrossRef(doi: string): Promise<Partial<MetadatosExtraidos>> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BiblioIA/1.0 (mailto:soporte@biblio-ia.app)' },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return {}
  const data = await res.json()
  const msg = data.message
  if (!msg) return {}

  const autores: string[] = (msg.author ?? []).slice(0, 5).map((a: Record<string, string>) => {
    const apellido = a.family ?? ''
    const iniciales = a.given ? `, ${a.given.charAt(0).toUpperCase()}.` : ''
    return `${apellido}${iniciales}`
  })

  const año = String(msg.published?.['date-parts']?.[0]?.[0] ?? msg['published-print']?.['date-parts']?.[0]?.[0] ?? '')
  const tipo = mapearTipoCrossRef(msg.type ?? '')

  // Para artículos: container-title es la revista; para libros: puede ser la serie
  const esArticulo = tipo === 'articulo'
  const revista = esArticulo ? (msg['container-title']?.[0] ?? '') : ''
  const editorial = (msg.publisher ?? '').slice(0, 150)

  const abstract = msg.abstract
    ? msg.abstract.replace(/<[^>]+>/g, '').trim().slice(0, 500)
    : ''

  const result: Partial<MetadatosExtraidos> = {
    fuente: 'crossref',
    tipo,
    doi: (msg.DOI ?? doi).toLowerCase(),
    url: msg.URL || msg.resource?.primary?.URL || undefined,
  }

  if (msg.title?.[0]) result.titulo = msg.title[0].trim().slice(0, 300)
  if (autores.length) result.autor = autores.join('; ')
  if (año) result.año = año
  if (revista) result.revista = revista.trim().slice(0, 200)
  if (editorial) result.editorial = editorial
  if (msg.volume) result.volumen = String(msg.volume)
  if (msg.issue) result.numero = String(msg.issue)
  if (msg.page) result.paginas = String(msg.page)
  if (abstract) result.abstract = abstract

  return result
}

async function buscarEnOpenLibrary(isbn: string): Promise<Partial<MetadatosExtraidos>> {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return {}
  const data = await res.json()

  const año = (data.publish_date ?? '').match(/\d{4}/)?.[0] ?? ''
  const editorial = Array.isArray(data.publishers) ? (data.publishers[0] ?? '') : ''

  let autor = ''
  if (Array.isArray(data.authors) && data.authors.length > 0) {
    try {
      const autorRes = await fetch(`https://openlibrary.org${data.authors[0].key}.json`, {
        signal: AbortSignal.timeout(4000),
      })
      if (autorRes.ok) {
        const autorData = await autorRes.json()
        autor = autorData.personal_name ?? autorData.name ?? ''
      }
    } catch { /* silencioso */ }
  }

  const result: Partial<MetadatosExtraidos> = {
    isbn,
    tipo: 'libro',
    fuente: 'openlibrary',
  }
  if (data.title) result.titulo = data.title.trim().slice(0, 300)
  if (autor) result.autor = autor
  if (año) result.año = año
  if (editorial) result.editorial = editorial.slice(0, 150)

  return result
}

export async function extraerMetadatos(buffer: Buffer): Promise<MetadatosExtraidos> {
  const resultado: MetadatosExtraidos = { fuente: 'pdf' }

  // 1. Metadatos embebidos en el PDF + texto de las primeras páginas
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const meta = await pdf.getMetadata()
    const info = (meta.info ?? {}) as Record<string, string>

    if (info.Title?.trim()) resultado.titulo = info.Title.trim().slice(0, 300)
    if (info.Author?.trim()) resultado.autor = info.Author.trim().slice(0, 200)
    if (info.Subject?.trim()) resultado.abstract = info.Subject.trim().slice(0, 500)
    if (info.Keywords?.trim()) {
      resultado.palabrasClave = info.Keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean).slice(0, 10)
    }
    const fechaStr = info.CreationDate?.toString() ?? ''
    const añoMatch = fechaStr.match(/(\d{4})/)
    if (añoMatch) resultado.año = añoMatch[1]

    // Texto de las primeras 3 páginas para buscar DOI/ISBN
    let texto = ''
    const pagesToScan = Math.min(3, pdf.numPages)
    for (let i = 1; i <= pagesToScan; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if ('str' in item) texto += (item as { str: string }).str + ' '
        if (texto.length > 4000) break
      }
      if (texto.length > 4000) break
    }
    const doi = extraerDOI(texto.slice(0, 4000))
    const isbn = extraerISBN(texto.slice(0, 4000))
    if (doi) resultado.doi = doi
    if (isbn) resultado.isbn = isbn
  } catch { /* PDF parsing failed, continuar */ }

  // 2. Enriquecer con CrossRef si hay DOI (fuente más completa para artículos)
  if (resultado.doi) {
    try {
      const cr = await buscarEnCrossRef(resultado.doi)
      if (cr.fuente === 'crossref') {
        if (cr.titulo) resultado.titulo = cr.titulo
        if (cr.autor) resultado.autor = cr.autor
        if (cr.año) resultado.año = cr.año
        if (cr.tipo) resultado.tipo = cr.tipo
        if (cr.revista) resultado.revista = cr.revista
        if (cr.editorial) resultado.editorial = cr.editorial
        if (cr.volumen) resultado.volumen = cr.volumen
        if (cr.numero) resultado.numero = cr.numero
        if (cr.paginas) resultado.paginas = cr.paginas
        if (cr.url) resultado.url = cr.url
        if (cr.abstract) resultado.abstract = cr.abstract
        if (cr.doi) resultado.doi = cr.doi
        resultado.fuente = 'crossref'
      }
    } catch { /* CrossRef no disponible */ }
  }

  // 3. Enriquecer con OpenLibrary si hay ISBN
  if (resultado.isbn && resultado.fuente !== 'crossref' && (!resultado.autor || !resultado.año)) {
    try {
      const ol = await buscarEnOpenLibrary(resultado.isbn)
      if (!resultado.titulo && ol.titulo) resultado.titulo = ol.titulo
      if (!resultado.autor && ol.autor) resultado.autor = ol.autor
      if (!resultado.año && ol.año) resultado.año = ol.año
      if (!resultado.editorial && ol.editorial) resultado.editorial = ol.editorial
      if (!resultado.tipo && ol.tipo) resultado.tipo = ol.tipo
      if (resultado.fuente === 'pdf') resultado.fuente = ol.fuente ?? 'pdf'
    } catch { /* OpenLibrary no disponible */ }
  }

  return resultado
}

// Formatea el autor extraído al estilo APA 7ma edición
export function formatearAutorAPA(autor: string): string {
  if (!autor) return ''
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,/.test(autor)) return autor
  const partes = autor.trim().split(/\s+/)
  if (partes.length >= 2) {
    const apellido = partes[partes.length - 1]
    const iniciales = partes.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
    return `${apellido}, ${iniciales}`
  }
  return autor
}
