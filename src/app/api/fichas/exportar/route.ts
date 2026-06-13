import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, readJSON, listPDFs } from '@/lib/drive'
import { FichaLectura, Documento } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx'
import { google } from 'googleapis'

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const documentoId = req.nextUrl.searchParams.get('documentoId')

    const estructura = await initUserDrive(accessToken)
    const authClient = getAuthClient(accessToken)
    const drive = google.drive({ version: 'v3', auth: authClient })

    const listRes = await drive.files.list({
      q: `'${estructura.notasId}' in parents and name contains 'ficha_' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 200,
    })

    let archivos = listRes.data.files ?? []

    if (documentoId) {
      archivos = archivos.filter((f) => f.name === `ficha_${documentoId}.json`)
    }

    // Cargar metadatos de documentos para enriquecer las fichas
    let docsMap: Record<string, Documento> = {}
    try {
      const docs = await listPDFs(accessToken, estructura.pdfsId)
      for (const d of docs) docsMap[d.id] = d
    } catch { /* sin metadatos */ }

    const fichas: FichaLectura[] = []
    for (const archivo of archivos) {
      if (!archivo.id) continue
      try {
        const ficha = await readJSON<FichaLectura>(accessToken, archivo.id)
        if (ficha) fichas.push(ficha)
      } catch { /* saltar fichas con error */ }
    }

    const SECCIONES: { key: keyof FichaLectura; label: string }[] = [
      { key: 'tesisCentral', label: 'Tesis central' },
      { key: 'argumentoPrincipal', label: 'Argumento principal' },
      { key: 'contextoProduccion', label: 'Contexto de producción' },
      { key: 'problemaInvestigacion', label: 'Problema de investigación' },
      { key: 'hipotesis', label: 'Hipótesis' },
      { key: 'metodologia', label: 'Metodología' },
      { key: 'marcoTeorico', label: 'Marco teórico' },
      { key: 'hallazgos', label: 'Hallazgos y conclusiones' },
      { key: 'limitaciones', label: 'Limitaciones' },
      { key: 'evaluacionCritica', label: 'Evaluación crítica' },
      { key: 'utilidadInvestigacion', label: 'Utilidad para la investigación' },
    ]

    const children: Paragraph[] = [
      new Paragraph({
        text: 'Fichas de lectura — BiblioIA',
        heading: HeadingLevel.HEADING_1,
      }),
    ]

    fichas.forEach((ficha, idx) => {
      const doc = docsMap[ficha.documentoId]
      const titulo = (doc?.nombre ?? ficha.documentoId).replace(/\.pdf$/i, '')
      const autorAnio = [doc?.autor, doc?.año].filter(Boolean).join(' · ')

      children.push(
        new Paragraph({
          text: titulo,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: idx === 0 ? 240 : 480 },
        })
      )

      if (autorAnio) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: autorAnio, color: '666666', size: 20 })],
            spacing: { after: 200 },
          })
        )
      }

      for (const sec of SECCIONES) {
        const valor = ficha[sec.key]
        if (!valor || typeof valor !== 'string' || !valor.trim()) continue
        children.push(
          new Paragraph({ text: sec.label, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [new TextRun({ text: valor })],
            spacing: { after: 160 },
          })
        )
      }

      if (ficha.conceptosClave?.length > 0) {
        children.push(new Paragraph({ text: 'Conceptos clave', heading: HeadingLevel.HEADING_2 }))
        for (const ck of ficha.conceptosClave) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: ck.concepto, bold: true }),
                new TextRun({ text: ck.definicion ? `: ${ck.definicion}` : '' }),
              ],
              spacing: { after: 100 },
            })
          )
        }
      }

      if (idx < fichas.length - 1) {
        children.push(
          new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: '─'.repeat(60), color: 'AAAAAA' })],
            alignment: AlignmentType.CENTER,
          })
        )
      }
    })

    if (fichas.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'No se encontraron fichas.', color: '999999' })],
        })
      )
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="fichas-biblioia.docx"',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
