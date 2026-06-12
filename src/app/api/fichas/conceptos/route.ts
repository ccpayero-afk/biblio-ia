import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, readJSON } from '@/lib/drive'
import { FichaLectura } from '@/types'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const authClient = new google.auth.OAuth2()
    authClient.setCredentials({ access_token: accessToken })
    const drive = google.drive({ version: 'v3', auth: authClient })

    const listRes = await drive.files.list({
      q: `'${estructura.notasId}' in parents and name contains 'ficha_' and mimeType='application/json' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1000,
    })

    const fichaFiles = (listRes.data.files ?? [])
      .map((f) => ({
        fileId: f.id!,
        documentoId: f.name?.match(/^ficha_(.+)\.json$/)?.[1] ?? '',
      }))
      .filter((f) => f.documentoId && f.fileId)

    if (fichaFiles.length === 0) return NextResponse.json([])

    const [docs, fichas] = await Promise.all([
      listPDFs(accessToken, estructura.pdfsId),
      Promise.all(
        fichaFiles.map(async ({ fileId, documentoId }) => {
          try {
            const ficha = await readJSON<FichaLectura>(accessToken, fileId)
            return { documentoId, conceptosClave: ficha.conceptosClave ?? [] }
          } catch {
            return { documentoId, conceptosClave: [] as FichaLectura['conceptosClave'] }
          }
        })
      ),
    ])

    const nombreMap: Record<string, string> = {}
    for (const d of docs) {
      nombreMap[d.id] = d.titulo ?? d.nombre.replace(/\.pdf$/i, '')
    }

    const items = fichas.flatMap(({ documentoId, conceptosClave }) =>
      conceptosClave
        .filter((c) => c.concepto?.trim() && c.definicion?.trim())
        .map((c, i) => ({
          kind: 'concepto' as const,
          id: `${documentoId}__${i}`,
          documentoId,
          documentoNombre: nombreMap[documentoId] ?? documentoId,
          concepto: c.concepto.trim(),
          definicion: c.definicion.trim(),
        }))
    )

    return NextResponse.json(items)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
