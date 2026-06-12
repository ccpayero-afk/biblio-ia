import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, uploadPDF } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const estructura = await initUserDrive(accessToken)
  const docs = await listPDFs(accessToken, estructura.porLeerFolderId!)
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const accessToken = getAccessToken(session)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const estructura = await initUserDrive(accessToken)
  const fileId = await uploadPDF(accessToken, estructura.porLeerFolderId!, file)
  return NextResponse.json({ id: fileId })
}
