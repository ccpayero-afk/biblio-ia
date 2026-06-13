import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, findFile, listPDFs } from '@/lib/drive'
import { semanticSearch } from '@/lib/search'
import { FichaLectura, Cita, Nota, Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const body = await req.json()
    const { tema, carpetasIds, format }: { tema: string; carpetasIds?: string[]; format?: string } = body

    if (!tema || !tema.trim()) {
      return NextResponse.json({ error: 'Se requiere un tema' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)

    // 1. Semantic search — top 20 fragments
    const fragmentos = await semanticSearch(tema, accessToken, { topK: 20 })

    // 2. Collapse to unique documents — best score per doc, take top 8
    const bestByDoc = new Map<string, { score: number; documentoId: string }>()
    for (const frag of fragmentos) {
      // semanticSearch returns sorted by similarity but doesn't expose it — use order as proxy
      // We trust the order: first occurrence of each doc = best score
      if (!bestByDoc.has(frag.documentoId)) {
        bestByDoc.set(frag.documentoId, {
          score: fragmentos.length - [...bestByDoc.keys()].length,
          documentoId: frag.documentoId,
        })
      }
    }

    const matchedDocIds = [...bestByDoc.keys()].slice(0, 8)

    // 3. Get doc metadata
    const allDocs = await listPDFs(accessToken, estructura.pdfsId)
    const docsMap = new Map<string, Documento>(allDocs.map((d) => [d.id, d]))

    // 4. Filter by carpetasIds if provided
    let filteredDocIds = matchedDocIds
    if (carpetasIds && carpetasIds.length > 0) {
      filteredDocIds = matchedDocIds.filter((docId) => {
        const doc = docsMap.get(docId)
        return doc?.carpetaId && carpetasIds.includes(doc.carpetaId)
      })
    }

    // 5. Load citas.json
    let todasCitas: Cita[] = []
    try {
      const citasFileId = await findFile(accessToken, 'citas.json', estructura.notasId)
      if (citasFileId) {
        todasCitas = await readJSON<Cita[]>(accessToken, citasFileId) ?? []
      }
    } catch { /* sin citas */ }

    // 6. Load notas.json
    let todasNotas: (Nota & { eliminadaEn?: string })[] = []
    try {
      const notasFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
      if (notasFileId) {
        todasNotas = await readJSON<(Nota & { eliminadaEn?: string })[]>(accessToken, notasFileId) ?? []
      }
    } catch { /* sin notas */ }

    // 7. For each matched doc, load ficha + filter citas
    type DocEntry = {
      docId: string
      doc: Documento | undefined
      ficha: FichaLectura | null
      citas: Cita[]
    }

    const docEntries: DocEntry[] = await Promise.all(
      filteredDocIds.map(async (docId) => {
        let ficha: FichaLectura | null = null
        try {
          const fichaFileId = await findFile(accessToken, `ficha_${docId}.json`, estructura.notasId)
          if (fichaFileId) {
            ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)
          }
        } catch { /* sin ficha */ }

        const citas = todasCitas.filter((c) => c.documentoId === docId)

        return {
          docId,
          doc: docsMap.get(docId),
          ficha,
          citas,
        }
      })
    )

    // 8. Filter notas: active, linked to matched docs OR tema keywords in title/content
    const temaWords = tema.split(/\s+/).filter((w) => w.length > 4)
    const matchedDocIdsSet = new Set(filteredDocIds)

    const notasFiltradas = todasNotas.filter((nota) => {
      if (nota.eliminadaEn) return false
      if (nota.documentoOrigenId && matchedDocIdsSet.has(nota.documentoOrigenId)) return true
      if (nota.documentoId && matchedDocIdsSet.has(nota.documentoId)) return true
      if (temaWords.length > 0) {
        const texto = `${nota.titulo ?? ''} ${nota.contenido ?? ''}`.toLowerCase()
        return temaWords.some((w) => texto.includes(w.toLowerCase()))
      }
      return false
    })

    // 9. Build preview stats
    const citasCount = docEntries.reduce((acc, e) => acc + e.citas.length, 0)
    const stats = {
      docsCount: filteredDocIds.length,
      citasCount,
      notasCount: notasFiltradas.length,
    }

    if (format === 'preview') {
      return NextResponse.json(stats)
    }

    // 10. Build DOCX
    const children: Paragraph[] = [
      new Paragraph({
        text: `Maletín de investigación: ${tema}`,
        heading: HeadingLevel.HEADING_1,
      }),
    ]

    for (const entry of docEntries) {
      const { doc, ficha, citas } = entry
      const nombreDoc = (doc?.nombre ?? entry.docId).replace(/\.pdf$/i, '')
      const autor = doc?.autor ?? ''
      const año = doc?.año ?? ''
      const heading2Text = autor || año ? `${autor} (${año}) — ${nombreDoc}` : nombreDoc

      children.push(
        new Paragraph({
          text: heading2Text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400 },
        })
      )

      if (ficha?.tesisCentral) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Tesis central: ', italics: true, bold: true }),
              new TextRun({ text: ficha.tesisCentral }),
            ],
            spacing: { after: 120 },
          })
        )
      }

      if (ficha?.posicionDebate) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: ficha.posicionDebate, italics: true, color: '555555' }),
            ],
            spacing: { after: 120 },
          })
        )
      }

      if (citas.length > 0) {
        children.push(
          new Paragraph({
            text: 'Citas relevantes',
            heading: HeadingLevel.HEADING_3,
          })
        )
        for (const cita of citas) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `"${cita.texto}"`, italics: true }),
                cita.pagina ? new TextRun({ text: ` (p. ${cita.pagina})`, color: '888888' }) : new TextRun({ text: '' }),
              ],
              indent: { left: 720 },
              spacing: { after: 100 },
            })
          )
          if (cita.notaPropia) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: `Nota: ${cita.notaPropia}`, color: '666666' })],
                indent: { left: 720 },
                spacing: { after: 80 },
              })
            )
          }
        }
      }
    }

    // Notas section
    if (notasFiltradas.length > 0) {
      children.push(
        new Paragraph({
          text: 'Notas de investigación',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 480 },
        })
      )

      for (const nota of notasFiltradas) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: nota.titulo || 'Sin título', bold: true })],
            spacing: { before: 240, after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: nota.contenido ?? '' })],
            spacing: { after: 160 },
          })
        )
      }
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)

    const safeFilename = `maletin-${tema.slice(0, 30).replace(/\s+/g, '-')}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
