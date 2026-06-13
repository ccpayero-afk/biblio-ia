import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { Cita } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const formato = req.nextUrl.searchParams.get('formato') ?? 'markdown'

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    const citas: Cita[] = fileId ? await readJSON<Cita[]>(accessToken, fileId) : []

    if (formato === 'bibtex') {
      const bibtex = citas.map((c, index) => {
        const rawKey = `${c.autor?.split(',')[0]?.trim().replace(/\s+/g, '') || 'Anon'}${c.año || 'sf'}${index + 1}`
        const key = rawKey.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '')
        const autor = c.autor || 'Anónimo'
        const year = c.año || 's.f.'
        const title = c.documentoNombre.replace(/\.pdf$/i, '')
        return `@misc{${key},\n  author = {${autor}},\n  year = {${year}},\n  title = {{${title}}},\n  note = {"${c.texto}" (p. ${c.pagina})},\n  howpublished = {${c.formatoAPA}}\n}`
      }).join('\n\n')
      return new NextResponse(bibtex, {
        headers: {
          'Content-Type': 'application/x-bibtex; charset=utf-8',
          'Content-Disposition': 'attachment; filename="citas-biblioia.bib"',
        },
      })
    }

    if (formato === 'docx') {
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: 'Banco de Citas — BiblioIA', heading: HeadingLevel.HEADING_1 }),
            ...citas.flatMap((c) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `"${c.texto}"`, italics: true }),
                ],
                spacing: { before: 240 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: c.formatoAPA, bold: true, size: 18 }),
                ],
                spacing: { after: 240 },
              }),
              ...(c.notaPropia ? [new Paragraph({ children: [new TextRun({ text: `Nota: ${c.notaPropia}`, color: '666666' })] })] : []),
            ]),
          ],
        }],
      })
      const buffer = await Packer.toBuffer(doc)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="citas-biblioia.docx"',
        },
      })
    }

    // Markdown
    const md = [
      '# Banco de Citas — BiblioIA\n',
      ...citas.map((c) => [
        `> "${c.texto}"`,
        `>`,
        `> — ${c.formatoAPA}`,
        c.notaPropia ? `\n*Nota:* ${c.notaPropia}` : '',
        '',
      ].filter(Boolean).join('\n')),
    ].join('\n')

    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="citas-biblioia.md"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
