import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, uploadPDF, updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

interface MetadatoImportado {
  titulo: string
  autor: string
  año: string
  editorial?: string
  abstract?: string
  etiquetas: string[]
}

function parseBibtex(contenido: string): MetadatoImportado[] {
  const { entries } = require('bibtex-parse')
  const parsed = entries(contenido) as Record<string, string>[]
  return parsed.map((e) => {
    const autor = e.AUTHOR ?? e.author ?? ''
    const año = e.YEAR ?? e.year ?? ''
    const titulo = e.TITLE ?? e.title ?? 'Sin título'
    const editorial = e.PUBLISHER ?? e.publisher ?? e.JOURNAL ?? e.journal ?? ''
    return {
      titulo: titulo.replace(/[{}]/g, ''),
      autor: autor.replace(/[{}]/g, '').replace(/ and /gi, ', '),
      año,
      editorial: editorial.replace(/[{}]/g, ''),
      etiquetas: [(e.type ?? 'bibliografía').toLowerCase()],
    }
  })
}

function parseZotero(contenido: string): MetadatoImportado[] {
  const items = JSON.parse(contenido)
  return items
    .filter((item: Record<string, unknown>) => item.itemType !== 'attachment')
    .map((item: Record<string, unknown>) => {
      const creators = (item.creators as { creatorType?: string; lastName?: string; firstName?: string; name?: string }[]) ?? []
      const autor = creators
        .filter((c) => c.creatorType === 'author' || !c.creatorType)
        .map((c) => (c.lastName ? `${c.lastName}, ${c.firstName ?? ''}`.trim() : (c.name ?? '')))
        .join('; ')
      const año = ((item.date as string) ?? '').slice(0, 4)
      return {
        titulo: (item.title as string) ?? 'Sin título',
        autor,
        año,
        abstract: (item.abstractNote as string) ?? '',
        etiquetas: [(item.itemType as string) ?? 'libro'],
      }
    })
}

// POST /api/importar?tipo=bibtex|zotero — parse metadata only
// POST /api/importar?tipo=pdf — upload PDF files with metadata
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const tipo = req.nextUrl.searchParams.get('tipo') ?? 'bibtex'

    if (tipo === 'bibtex' || tipo === 'zotero') {
      const { contenido } = await req.json()
      const metadatos = tipo === 'bibtex' ? parseBibtex(contenido) : parseZotero(contenido)
      return NextResponse.json({ metadatos })
    }

    if (tipo === 'pdf') {
      const formData = await req.formData()
      const estructura = await initUserDrive(accessToken)
      const resultados: { nombre: string; id: string; ok: boolean; error?: string }[] = []

      for (const [key, value] of formData.entries()) {
        if (!(value instanceof File)) continue
        const metaStr = formData.get(`meta_${key}`)
        const meta = metaStr ? JSON.parse(metaStr as string) : {}
        try {
          const fileId = await uploadPDF(accessToken, estructura.pdfsId, value)
          await updateDocumentMetadata(accessToken, fileId, {
            autor: meta.autor ?? '',
            año: meta.año ?? '',
            editorial: meta.editorial ?? '',
            etiquetas: meta.etiquetas ?? [],
          })
          resultados.push({ nombre: value.name, id: fileId, ok: true })
        } catch (e) {
          resultados.push({ nombre: value.name, id: '', ok: false, error: String(e) })
        }
      }

      return NextResponse.json({ resultados })
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
