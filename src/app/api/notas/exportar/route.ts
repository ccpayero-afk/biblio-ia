import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { leerTodasCompletas } from '@/lib/notas'
import { Nota } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const tipoParam = req.nextUrl.searchParams.get('tipo')

    let notas = await leerTodasCompletas(accessToken)
    notas = notas.filter((n) => !(n as Nota & { eliminadaEn?: string }).eliminadaEn)
    if (tipoParam) notas = notas.filter((n) => n.tipo === tipoParam)

    const children: Paragraph[] = [
      new Paragraph({
        text: 'Notas — BiblioIA',
        heading: HeadingLevel.HEADING_1,
      }),
    ]

    notas.forEach((nota, idx) => {
      children.push(
        new Paragraph({
          text: nota.titulo || 'Sin título',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: idx === 0 ? 240 : 360 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `[${nota.tipo}]`, color: '888888', size: 18 })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: nota.contenido ?? '' })],
          spacing: { after: 160 },
        })
      )

      const etiquetasUsuario = (nota.etiquetas ?? []).filter(
        (e) => e !== 'auto-ficha' && e !== 'auto-highlights'
      )
      if (etiquetasUsuario.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Etiquetas: ${etiquetasUsuario.join(', ')}`, italics: true, color: '666666' }),
            ],
            spacing: { after: 120 },
          })
        )
      }

      if (idx < notas.length - 1) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '─'.repeat(60), color: 'CCCCCC' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 160 },
          })
        )
      }
    })

    if (notas.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'No se encontraron notas.', color: '999999' })],
        })
      )
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="notas-biblioia.docx"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
