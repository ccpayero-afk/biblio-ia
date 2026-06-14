import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, findFile, listPDFs } from '@/lib/drive'
import type { FichaLectura, Cita, Nota, Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { tema, docIds } = (await req.json()) as { tema: string; docIds: string[] }

    if (!tema?.trim()) return NextResponse.json({ error: 'Se requiere un tema' }, { status: 400 })
    if (!docIds?.length) return NextResponse.json({ error: 'No se indicaron documentos' }, { status: 400 })

    const estructura = await initUserDrive(accessToken)
    const allDocs = await listPDFs(accessToken, estructura.pdfsId)
    const docsMap = new Map<string, Documento>(allDocs.map(d => [d.id, d]))

    // Load citas
    let todasCitas: Cita[] = []
    try {
      const id = await findFile(accessToken, 'citas.json', estructura.notasId)
      if (id) todasCitas = await readJSON<Cita[]>(accessToken, id) ?? []
    } catch { /* sin citas */ }

    // Load notas
    let todasNotas: (Nota & { eliminadaEn?: string })[] = []
    try {
      const id = await findFile(accessToken, 'notas.json', estructura.notasId)
      if (id) todasNotas = await readJSON<(Nota & { eliminadaEn?: string })[]>(accessToken, id) ?? []
    } catch { /* sin notas */ }

    // Build doc entries
    const docEntries = await Promise.all(docIds.map(async docId => {
      let ficha: FichaLectura | null = null
      try {
        const fid = await findFile(accessToken, `ficha_${docId}.json`, estructura.notasId)
        if (fid) ficha = await readJSON<FichaLectura>(accessToken, fid)
      } catch { /* sin ficha */ }
      return { docId, doc: docsMap.get(docId), ficha, citas: todasCitas.filter(c => c.documentoId === docId) }
    }))

    // Filter notas
    const temaWords = tema.split(/\s+/).filter(w => w.length > 4)
    const docIdSet = new Set(docIds)
    const notasFiltradas = todasNotas.filter(n => {
      if (n.eliminadaEn) return false
      if (n.documentoOrigenId && docIdSet.has(n.documentoOrigenId)) return true
      if (n.documentoId && docIdSet.has(n.documentoId)) return true
      if (temaWords.length) {
        const txt = `${n.titulo ?? ''} ${n.contenido ?? ''}`.toLowerCase()
        return temaWords.some(w => txt.includes(w.toLowerCase()))
      }
      return false
    })

    // Build DOCX
    const children: Paragraph[] = [
      new Paragraph({ text: `Maletín de investigación: ${tema}`, heading: HeadingLevel.HEADING_1 }),
    ]

    for (const { doc, ficha, citas } of docEntries) {
      const nombre = (doc?.nombre ?? '').replace(/\.pdf$/i, '')
      const autor = doc?.autor ?? ''
      const año = doc?.año ?? ''
      children.push(new Paragraph({
        text: autor || año ? `${autor} (${año}) — ${nombre}` : nombre,
        heading: HeadingLevel.HEADING_2, spacing: { before: 400 },
      }))
      if (ficha?.tesisCentral) children.push(new Paragraph({
        children: [new TextRun({ text: 'Tesis central: ', italics: true, bold: true }), new TextRun({ text: ficha.tesisCentral })],
        spacing: { after: 120 },
      }))
      if (ficha?.posicionDebate) children.push(new Paragraph({
        children: [new TextRun({ text: ficha.posicionDebate, italics: true, color: '555555' })],
        spacing: { after: 120 },
      }))
      if (citas.length) {
        children.push(new Paragraph({ text: 'Citas relevantes', heading: HeadingLevel.HEADING_3 }))
        for (const c of citas) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `"${c.texto}"`, italics: true }), c.pagina ? new TextRun({ text: ` (p. ${c.pagina})`, color: '888888' }) : new TextRun({ text: '' })],
            indent: { left: 720 }, spacing: { after: 100 },
          }))
          if (c.notaPropia) children.push(new Paragraph({
            children: [new TextRun({ text: `Nota: ${c.notaPropia}`, color: '666666' })],
            indent: { left: 720 }, spacing: { after: 80 },
          }))
        }
      }
    }

    if (notasFiltradas.length) {
      children.push(new Paragraph({ text: 'Notas de investigación', heading: HeadingLevel.HEADING_2, spacing: { before: 480 } }))
      for (const n of notasFiltradas) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: n.titulo || 'Sin título', bold: true })], spacing: { before: 240, after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: n.contenido ?? '' })], spacing: { after: 160 } })
        )
      }
    }

    const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }))
    const safe = `maletin-${tema.slice(0, 30).replace(/\s+/g, '-')}.docx`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safe}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
