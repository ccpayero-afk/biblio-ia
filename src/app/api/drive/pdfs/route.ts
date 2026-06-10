import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, uploadPDF, updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    return NextResponse.json(documentos)
  } catch (e) {
    console.error('[GET /api/drive/pdfs]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)
    const ids: string[] = []
    for (let i = 0; i < files.length; i++) {
      const fileId = await uploadPDF(accessToken, estructura.pdfsId, files[i])
      // carpetaId_0, carpetaId_1 … per-file; or global carpetaId fallback
      const carpetaId =
        (formData.get(`carpetaId_${i}`) as string | null) ??
        (formData.get('carpetaId') as string | null)
      if (carpetaId) await updateDocumentMetadata(accessToken, fileId, { carpetaId })
      ids.push(fileId)
    }
    return NextResponse.json({ ok: true, ids })
  } catch (e) {
    console.error('[POST /api/drive/pdfs]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
