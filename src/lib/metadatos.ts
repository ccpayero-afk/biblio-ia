// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse')

export interface MetadatosExtraidos {
  titulo?: string
  autor?: string
  año?: string
  editorial?: string
  abstract?: string
  doi?: string
  isbn?: string
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

  const autores: string[] = (msg.author ?? []).slice(0, 3).map((a: Record<string, string>) => {
    const apellido = a.family ?? ''
    const iniciales = a.given ? `, ${a.given.charAt(0).toUpperCase()}.` : ''
    return `${apellido}${iniciales}`
  })

  const año = String(msg.published?.['date-parts']?.[0]?.[0] ?? '')
  const editorial = (msg.publisher ?? msg['container-title']?.[0] ?? '').slice(0, 100)
  const abstract = msg.abstract
    ? msg.abstract.replace(/<[^>]+>/g, '').trim().slice(0, 400)
    : ''

  return {
    autor: autores.join('; ') || undefined,
    año: año || undefined,
    editorial: editorial || undefined,
    abstract: abstract || undefined,
    doi: (msg.DOI ?? doi).toLowerCase(),
    fuente: 'crossref',
  }
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

  return {
    autor: autor || undefined,
    año: año || undefined,
    editorial: editorial.slice(0, 100) || undefined,
    isbn,
    fuente: 'openlibrary',
  }
}

export async function extraerMetadatos(buffer: Buffer): Promise<MetadatosExtraidos> {
  const resultado: MetadatosExtraidos = { fuente: 'pdf' }

  // 1. Metadatos embebidos en el PDF + texto de las primeras páginas
  try {
    const parsed = await new PDFParse().parse(buffer, { max: 3 })
    const info = (parsed.info ?? {}) as Record<string, string>

    if (info.Title?.trim()) resultado.titulo = info.Title.trim().slice(0, 200)
    if (info.Author?.trim()) resultado.autor = info.Author.trim().slice(0, 200)
    if (info.Subject?.trim()) resultado.abstract = info.Subject.trim().slice(0, 400)
    if (info.Keywords?.trim()) {
      resultado.palabrasClave = info.Keywords.split(/[,;]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10)
    }

    // Extraer año de la fecha de creación del PDF
    const fechaStr = info.CreationDate?.toString() ?? ''
    const añoMatch = fechaStr.match(/(\d{4})/)
    if (añoMatch) resultado.año = añoMatch[1]

    // Buscar DOI e ISBN en el texto de las primeras páginas
    const texto = (parsed.text ?? '').slice(0, 4000)
    const doi = extraerDOI(texto)
    const isbn = extraerISBN(texto)
    if (doi) resultado.doi = doi
    if (isbn) resultado.isbn = isbn
  } catch { /* PDF parsing failed, continuar */ }

  // 2. Enriquecer con CrossRef si hay DOI
  if (resultado.doi) {
    try {
      const cr = await buscarEnCrossRef(resultado.doi)
      if (cr.fuente === 'crossref') {
        if (cr.autor) resultado.autor = cr.autor
        if (cr.año) resultado.año = cr.año
        if (cr.editorial) resultado.editorial = cr.editorial
        if (cr.abstract) resultado.abstract = cr.abstract
        if (cr.doi) resultado.doi = cr.doi
        resultado.fuente = 'crossref'
      }
    } catch { /* CrossRef no disponible */ }
  }

  // 3. Enriquecer con OpenLibrary si hay ISBN y aún falta info básica
  if (resultado.isbn && resultado.fuente !== 'crossref' && (!resultado.autor || !resultado.año)) {
    try {
      const ol = await buscarEnOpenLibrary(resultado.isbn)
      if (!resultado.autor && ol.autor) resultado.autor = ol.autor
      if (!resultado.año && ol.año) resultado.año = ol.año
      if (!resultado.editorial && ol.editorial) resultado.editorial = ol.editorial
      if (resultado.fuente === 'pdf') resultado.fuente = ol.fuente ?? 'pdf'
    } catch { /* OpenLibrary no disponible */ }
  }

  return resultado
}

// Formatea el autor extraído al estilo APA 7ma edición
export function formatearAutorAPA(autor: string): string {
  if (!autor) return ''
  // Si ya viene "Apellido, I." no tocamos
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,/.test(autor)) return autor
  // Si viene "Nombre Apellido", invertir
  const partes = autor.trim().split(/\s+/)
  if (partes.length >= 2) {
    const apellido = partes[partes.length - 1]
    const iniciales = partes.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
    return `${apellido}, ${iniciales}`
  }
  return autor
}
