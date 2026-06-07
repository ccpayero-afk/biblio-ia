import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, uploadPDF } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  const accessToken = getAccessToken(session)

  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  return NextResponse.json(documentos)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const accessToken = getAccessToken(session)

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 })
  }

  const estructura = await initUserDrive(accessToken)
  const ids = await Promise.all(files.map((f) => uploadPDF(accessToken, estructura.pdfsId, f)))
  return NextResponse.json({ ok: true, ids })
}
